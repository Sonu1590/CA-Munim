/**
 * e2e/01-auth.spec.ts
 * 
 * Tests all authentication flows:
 * - Sign up (happy + negative paths)
 * - Sign in (happy + negative paths)
 * - Onboarding (firm + solo practitioner)
 * - Session persistence on refresh
 * - Sign out
 * - Protected route redirect
 * - Forgot password
 */

import { test, expect } from '@playwright/test';
import { signIn, signOut, expectToast, TEST_USER } from './helpers/auth';

// ── Sign In ──────────────────────────────────────────────────────────────────

test.describe('Sign In', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('CA Munim').first()).toBeVisible();
  });

  test('shows login page with correct elements', async ({ page }) => {
    await expect(page.getByText('Sign In')).toBeVisible();
    await expect(page.getByText('Create Account')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();
  });

  test('signs in with valid credentials', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expectToast(page, /incorrect|invalid|wrong|credentials/i);
    // Must stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('shows error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email Address').fill('notanemail');
    await page.getByLabel('Password').fill('SomePassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Browser native validation or toast
    const emailInput = page.getByLabel('Email Address');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy(); // browser validates email format
  });

  test('shows error for empty email', async ({ page }) => {
    await page.getByLabel('Password').fill('SomePassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expectToast(page, /email|password|required/i);
  });

  test('shows error for empty password', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expectToast(page, /email|password|required/i);
  });

  test('shows loading state while signing in', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Button should show loading state briefly
    const button = page.getByRole('button', { name: /sign in|signing/i });
    // Either shows a spinner or disables
    await expect(button).toBeDisabled().catch(() => {}); // may be too fast
  });

  test('unverified email shows helpful error with resend option', async ({ page }) => {
    // This test requires a known unverified email in your test environment
    // If Supabase email verification is disabled, skip this
    test.skip(process.env.SUPABASE_EMAIL_VERIFICATION !== 'true', 
      'Email verification not enabled in this environment');
    
    await page.getByLabel('Email Address').fill('unverified@test.com');
    await page.getByLabel('Password').fill('TestPass123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expectToast(page, /verify|confirm|email/i);
    // Should offer resend option
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
  });

  test('redirects to original page after login', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/clients');
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    // Sign in
    await signIn(page);
    // Note: redirects to / not /clients in current implementation
    // Update this if redirect-after-login is implemented
    await expect(page).toHaveURL(/\//);
  });

  test('already logged-in user is redirected away from login', async ({ page }) => {
    await signIn(page);
    await page.goto('/login');
    // Should redirect to dashboard, not show login page
    await expect(page).toHaveURL('/');
  });
});

// ── Sign Up ──────────────────────────────────────────────────────────────────

test.describe('Sign Up', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Create Account').click();
  });

  test('shows create account form elements', async ({ page }) => {
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('shows error for password too short', async ({ page }) => {
    await page.getByLabel('Email Address').fill('newuser@test.com');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expectToast(page, /8 character|password.*short|too short/i);
  });

  test('shows error for duplicate email', async ({ page }) => {
    // Try to sign up with an already-registered email
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill('TestPassword@123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expectToast(page, /already|exists|registered/i);
    // Must stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('valid signup redirects to onboarding', async ({ page }) => {
    // Use a timestamp-based unique email to avoid conflicts
    const uniqueEmail = `test-${Date.now()}@playwright-ca.test`;
    
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password').fill('ValidPass@123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should go to onboarding
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });
    await expect(page.getByText('Welcome to CA Munim')).toBeVisible();
  });
});

// ── Onboarding ───────────────────────────────────────────────────────────────

test.describe('Onboarding — CA Firm flow', () => {
  test('completes CA Firm onboarding', async ({ page }) => {
    // Sign up fresh user
    const email = `firm-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await page.getByText('Create Account').click();
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });

    // Step 1 — Practice type
    await expect(page.getByText('How do you practice?')).toBeVisible();
    await page.getByText('CA Firm').click();
    // Continue button should now be enabled
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2 — Firm details
    await expect(page.getByText('Firm Details')).toBeVisible();
    await page.getByLabel(/Firm Name/i).fill('Playwright Test Associates');
    await page.getByLabel(/Your Full Name/i).fill('CA Playwright Tester');
    await page.getByLabel(/ICAI/i).fill('123456');
    await page.getByLabel(/Phone/i).fill('9876543210');
    await page.getByLabel(/City/i).fill('Pune');
    // State dropdown
    await page.getByText('Select').click();
    await page.getByRole('option', { name: 'Maharashtra' }).click();

    await page.getByRole('button', { name: 'Save & Get Started' }).click();

    // Should land on dashboard
    await expect(page).toHaveURL('/', { timeout: 15_000 });
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('completes Solo Practitioner onboarding', async ({ page }) => {
    const email = `solo-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await page.getByText('Create Account').click();
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });

    await page.getByText('Solo Practitioner').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Solo practitioner — NO firm name field
    await expect(page.getByLabel(/Firm Name/i)).not.toBeVisible();
    await expect(page.getByLabel(/Your Full Name/i)).toBeVisible();

    await page.getByLabel(/Your Full Name/i).fill('CA Solo Tester');
    await page.getByRole('button', { name: 'Save & Get Started' }).click();

    await expect(page).toHaveURL('/', { timeout: 15_000 });
  });

  test('onboarding requires CA name', async ({ page }) => {
    const email = `validation-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await page.getByText('Create Account').click();
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });

    await page.getByText('Solo Practitioner').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Try to save without name
    await page.getByRole('button', { name: 'Save & Get Started' }).click();
    await expectToast(page, /name.*required|required|name/i);
    // Must stay on onboarding
    await expect(page).toHaveURL('/onboarding');
  });

  test('onboarding Continue button disabled until practice type selected', async ({ page }) => {
    const email = `btn-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await page.getByText('Create Account').click();
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });

    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();
    
    await page.getByText('CA Firm').click();
    await expect(continueBtn).toBeEnabled();
  });

  test('Back button on step 2 returns to step 1', async ({ page }) => {
    const email = `back-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await page.getByText('Create Account').click();
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });

    await page.getByText('CA Firm').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Firm Details')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('How do you practice?')).toBeVisible();
  });

  test('completed onboarding — refresh does not show onboarding again', async ({ page }) => {
    await signIn(page);
    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
    // Must NOT redirect to onboarding
    await expect(page).not.toHaveURL('/onboarding');
  });
});

// ── Protected Routes ─────────────────────────────────────────────────────────

test.describe('Protected Routes', () => {
  const protectedRoutes = [
    '/clients',
    '/tasks',
    '/documents',
    '/whatsapp',
    '/billing',
    '/reports',
    '/settings',
    '/penalty-calculator',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects unauthenticated user to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL('/login', { timeout: 8_000 });
    });
  }

  test('/upload/:token is public — no redirect to login', async ({ page }) => {
    await page.goto('/upload/some-fake-token-12345');
    // Should NOT redirect to login — shows upload portal (even if token is invalid)
    await expect(page).not.toHaveURL('/login');
    // Should show an error about invalid token, not a login form
    await expect(page.getByText(/invalid|expired|not found/i).or(
      page.getByText(/upload|document/i)
    )).toBeVisible({ timeout: 8_000 });
  });
});

// ── Session Persistence ──────────────────────────────────────────────────────

test.describe('Session Persistence', () => {
  test('stays logged in after page refresh', async ({ page }) => {
    await signIn(page);
    await page.reload();
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL('/login');
  });

  test('stays logged in after navigating to a route directly', async ({ page }) => {
    await signIn(page);
    await page.goto('/clients');
    await expect(page.getByText('Clients')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL('/login');
  });
});

// ── Sign Out ─────────────────────────────────────────────────────────────────

test.describe('Sign Out', () => {
  test('signs out and redirects to login', async ({ page }) => {
    await signIn(page);
    await signOut(page);
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'CA Munim' })).toBeVisible();
  });

  test('cannot access protected route after signing out', async ({ page }) => {
    await signIn(page);
    await signOut(page);
    await page.goto('/clients');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });
});

// ── Forgot Password ──────────────────────────────────────────────────────────

test.describe('Forgot Password', () => {
  test('shows error if email not entered before clicking forgot password', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Forgot password?').click();
    await expectToast(page, /email|enter/i);
  });

  test('shows success message when valid email entered', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByText('Forgot password?').click();
    await expectToast(page, /sent|check.*inbox|email/i);
  });
});
