/**
 * e2e/12-reset-password.spec.ts
 *
 * Tests the password reset flow in two parts:
 *
 * 1. "Forgot password?" on the login page (src/pages/AuthPage.tsx) — sends
 *    a reset email via supabase.auth.resetPasswordForEmail. 01-auth.spec.ts
 *    already covers the empty-email and known-TEST_USER-email cases; this
 *    file adds the email-enumeration check (an unknown email must still
 *    show success, or the endpoint would leak which emails are registered)
 *    and the mode-gating check.
 *
 * 2. ResetPasswordPage (src/pages/ResetPasswordPage.tsx) — normally only
 *    reachable via a real recovery-link email, which is out of scope for
 *    E2E without an email-reading fixture (per the task brief). Covered
 *    here instead:
 *    - No session at all (a fresh anonymous context) -> redirected to
 *      /login with an "invalid or expired" toast. Safe, no account touched.
 *    - A signed-in session (any session, not specifically a recovery one —
 *      the page's own check is just `if (!session)`) is enough to reach
 *      the form, which lets the client-side password-strength/validation
 *      UI be tested for real. The "Set New Password" button is
 *      DELIBERATELY NEVER CLICKED anywhere in this file: it calls
 *      supabase.auth.updateUser({ password }) for real, which would change
 *      TEST_USER's actual password and break every other spec's signIn()
 *      for the rest of this shared test account's life.
 */
import { test, expect } from './helpers/coverage';
import { signIn, expectToast, switchToSignUpTab, authModeTab } from './helpers/auth';

test.describe('Forgot Password - email enumeration and mode gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('CA Munim').first()).toBeVisible();
  });

  test('an unregistered email still shows the generic success message', async ({ page }) => {
    // Supabase's resetPasswordForEmail returns success regardless of
    // whether the address is registered — asserting that here guards
    // against a future change accidentally leaking which emails exist.
    await page.getByLabel('Email Address').fill(`nonexistent-${Date.now()}@playwright-ca.test`);
    await page.getByText('Forgot password?').click();
    await expectToast(page, /sent|check.*inbox|email/i);
  });

  test('"Forgot password?" is only shown on the Sign In tab, not Create Account', async ({ page }) => {
    await expect(page.getByText('Forgot password?')).toBeVisible();
    await switchToSignUpTab(page);
    await expect(page.getByText('Forgot password?')).not.toBeVisible();
    await authModeTab(page, /^sign.?in$/i).click();
    await expect(page.getByText('Forgot password?')).toBeVisible();
  });
});

test.describe('Reset Password page - no session', () => {
  test('visiting directly with no session redirects to login with an error', async ({ browser }) => {
    // A brand-new, fully unauthenticated context — never the shared `page`.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto('/reset-password');
      await expect(anonPage).toHaveURL('/login', { timeout: 10_000 });
      await expectToast(anonPage, /invalid or expired reset link/i);
    } finally {
      await anonContext.close();
    }
  });
});

test.describe('Reset Password page - form validation (never submits)', () => {
  test.beforeEach(async ({ page }) => {
    // Any active session satisfies ResetPasswordPage's own check
    // (`if (!session)`), so signing in normally is enough to reach the
    // form and exercise its client-side validation safely.
    await signIn(page);
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Reset Your Password' })).toBeVisible({ timeout: 10_000 });
  });

  test('shows the form with password requirements and a disabled submit button', async ({ page }) => {
    await expect(page.getByLabel('New Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm New Password')).toBeVisible();
    await expect(page.getByText('At least 8 characters')).toBeVisible();
    await expect(page.getByText('One uppercase letter')).toBeVisible();
    await expect(page.getByText('One number')).toBeVisible();
    await expect(page.getByRole('button', { name: /set new password/i })).toBeDisabled();
  });

  test('password strength meter reflects a weak vs a strong password', async ({ page }) => {
    await page.getByLabel('New Password', { exact: true }).fill('abc');
    await expect(page.getByText('Strength:')).toBeVisible();
    await expect(page.getByText('Weak', { exact: true })).toBeVisible();

    await page.getByLabel('New Password', { exact: true }).fill('Str0ng!Passw0rd123');
    await expect(page.getByText('Strong', { exact: true })).toBeVisible();
  });

  test('requirement checklist ticks off as the password satisfies each rule', async ({ page }) => {
    const requirements = page.locator('ul').filter({ hasText: 'At least 8 characters' });
    await page.getByLabel('New Password', { exact: true }).fill('longenough');
    await expect(requirements.getByText('At least 8 characters')).toHaveClass(/text-green-600/);
    await expect(requirements.getByText('One uppercase letter')).not.toHaveClass(/text-green-600/);

    await page.getByLabel('New Password', { exact: true }).fill('LongEnough1');
    await expect(requirements.getByText('One uppercase letter')).toHaveClass(/text-green-600/);
    await expect(requirements.getByText('One number')).toHaveClass(/text-green-600/);
  });

  test('mismatched confirmation shows an error, matching shows success', async ({ page }) => {
    await page.getByLabel('New Password', { exact: true }).fill('MyNewPass1');
    await page.getByLabel('Confirm New Password').fill('Different1');
    await expect(page.getByText('Passwords do not match.')).toBeVisible();

    await page.getByLabel('Confirm New Password').fill('MyNewPass1');
    await expect(page.getByText('✓ Passwords match.')).toBeVisible();
    await expect(page.getByText('Passwords do not match.')).not.toBeVisible();
  });

  test('submit button enables only once both fields are filled', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /set new password/i });
    await expect(submitBtn).toBeDisabled();
    await page.getByLabel('New Password', { exact: true }).fill('MyNewPass1');
    await expect(submitBtn).toBeDisabled();
    await page.getByLabel('Confirm New Password').fill('MyNewPass1');
    await expect(submitBtn).toBeEnabled();
    // Deliberately not clicking it — see file header.
  });

  test('the eye icon toggles password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel('New Password', { exact: true });
    await passwordInput.fill('MyNewPass1');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // The toggle button has no accessible name — it's the icon-only button
    // right after the password input.
    await passwordInput.locator('xpath=following-sibling::button[1]').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('Cancel navigates away without submitting anything', async ({ page }) => {
    await page.getByLabel('New Password', { exact: true }).fill('MyNewPass1');
    await page.getByLabel('Confirm New Password').fill('MyNewPass1');
    await page.getByText('Cancel — back to Sign In').click();
    // Cancel calls navigate("/login"), but since this test is already
    // signed in, App.tsx's own /login route bounces an authenticated user
    // straight to "/" — so the end state is the dashboard, not /login.
    await expect(page).not.toHaveURL(/reset-password/, { timeout: 8_000 });
    await expect(page).toHaveURL('/', { timeout: 8_000 });
  });
});
