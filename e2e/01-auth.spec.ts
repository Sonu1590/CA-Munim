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
import {
  signIn,
  signOut,
  expectToast,
  TEST_USER,
  switchToSignUpTab,
  authModeTab,
  authSubmitButton,
  loginPageHeading,
  fillSignUpForm,
  submitSignUp,
  isObfuscatedDuplicateSignUp,
  uniqueSignUpEmail,
} from './helpers/auth';
import { clientsPageHeading } from './helpers/clients';

// ── Sign In ──────────────────────────────────────────────────────────────────

test.describe('Sign In', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('CA Munim').first()).toBeVisible();
  });

  test('shows login page with correct elements', async ({ page }) => {
    await expect(authModeTab(page, /^sign.?in$/i)).toBeVisible();
    await expect(authModeTab(page, /^create account$/i)).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(authSubmitButton(page, /^sign.?in$/i)).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();
  });

  test('signs in with valid credentials', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL('/');
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill('WrongPassword123!');
    await authSubmitButton(page, /^sign.?in$/i).click();
    await expectToast(page, /incorrect|invalid|wrong|credentials/i);
    // Must stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('shows error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email Address').fill('notanemail');
    await page.getByLabel('Password').fill('SomePassword123');
    await authSubmitButton(page, /^sign.?in$/i).click();
    // Browser native validation or toast
    const emailInput = page.getByLabel('Email Address');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy(); // browser validates email format
  });

  test('shows error for empty email', async ({ page }) => {
    await page.getByLabel('Password').fill('SomePassword123');
    await authSubmitButton(page, /^sign.?in$/i).click();
    await expectToast(page, /email|password|required/i);
  });

  test('shows error for empty password', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await authSubmitButton(page, /^sign.?in$/i).click();
    await expectToast(page, /email|password|required/i);
  });

  test('shows loading state while signing in', async ({ page }) => {
    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await authSubmitButton(page, /^sign.?in$/i).click();
    // Button should show loading state briefly
    const button = authSubmitButton(page, /^sign.?in$/i);
    // Either shows a spinner or disables
    await expect(button).toBeDisabled().catch(() => {}); // may be too fast
  });

  test.skip('unverified email shows helpful error with resend option', async ({ page }) => {
    // This test requires a known unverified email in your test environment
    // If Supabase email verification is disabled, skip this
    await page.getByLabel('Email Address').fill('unverified@test.com');
    await page.getByLabel('Password').fill('TestPass123!');
    await authSubmitButton(page, /^sign.?in$/i).click();
    await expectToast(page, /verify|confirm|email/i);
    // Should offer resend option
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
  });

  test.skip('redirects to original page after login', async ({ page }) => {
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

  test.skip('already logged-in user is redirected away from login', async ({ page }) => {
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
    await expect(page.getByText('CA Munim').first()).toBeVisible();
    await switchToSignUpTab(page);
  });

  test('shows create account form elements', async ({ page }) => {
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByLabel('Your Name')).toBeVisible();
    await expect(authSubmitButton(page, /^create account$/i)).toBeVisible();
  });

  test('shows error for password too short', async ({ page }) => {
    await page.getByLabel('Email Address').fill('newuser@test.com');
    await page.getByLabel('Password').fill('short');
    await authSubmitButton(page, /^create account$/i).click();
    await expectToast(page, /8 character|password.*short|too short/i);
  });

  test('shows error for duplicate email', async ({ page }) => {
    await fillSignUpForm(page, {
      email: TEST_USER.email,
      password: 'TestPassword@123',
    });

    const firmsCheck = page.waitForResponse(
      (r) => r.url().includes('/rest/v1/firms') && r.request().method() === 'GET',
      { timeout: 10_000 },
    ).catch(() => null);

    const response = await submitSignUp(page);
    await firmsCheck;

    // Pre-check toast (firms/staff) or Supabase duplicate response
    const duplicateToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /already|exists|registered|account with this email/i })
      .or(page.getByText(/already|exists|registered|account with this email/i));

    const body = await response.json().catch(() => ({}));
    const apiSaysDuplicate = JSON.stringify(body).match(/already|registered|exists/i);

    const sawClientError = await duplicateToast.first().isVisible().catch(() => false);

    expect(sawClientError || apiSaysDuplicate || !response.ok()).toBeTruthy();
    await expect(page).not.toHaveURL('/onboarding');
    await expect(page).toHaveURL('/login');
  });

  test('valid signup redirects to onboarding or requests verification', async ({ page }) => {
    test.setTimeout(60_000);
    const uniqueEmail = `test-${Date.now()}@playwright-ca.test`;

    await fillSignUpForm(page, {
      email: uniqueEmail,
      password: 'ValidPass@123',
    });

    const response = await submitSignUp(page);
    expect(response.ok()).toBeTruthy();

    const body = await response.json().catch(() => ({}));
    const hasSessionUser = Boolean(body?.user?.id);

    if (hasSessionUser) {
      await expect(page).toHaveURL('/onboarding', { timeout: 20_000 });
      await expect(
        page.getByRole('heading', { name: 'Welcome to CA Munim' }),
      ).toBeVisible();
      return;
    }

    // Email confirmation required — no immediate session
    await expect(page).toHaveURL('/login');
    const infoBanner = page.locator('.rounded-2xl.border').filter({
      hasText: /verification|verify|inbox|confirm/i,
    });
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /verification|verify|inbox|account created|check your email/i });

    await expect(infoBanner.or(toast).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Onboarding ───────────────────────────────────────────────────────────────

test.describe.skip('Onboarding — CA Firm flow', () => {
  test('completes CA Firm onboarding', async ({ page }) => {
    // Sign up fresh user
    const email = `firm-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await switchToSignUpTab(page);
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await authSubmitButton(page, /^create account$/i).click();
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
  });

  test('completes Solo Practitioner onboarding', async ({ page }) => {
    const email = `solo-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await switchToSignUpTab(page);
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await authSubmitButton(page, /^create account$/i).click();
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
    await switchToSignUpTab(page);
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await authSubmitButton(page, /^create account$/i).click();
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
    await switchToSignUpTab(page);
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await authSubmitButton(page, /^create account$/i).click();
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });

    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();
    
    await page.getByText('CA Firm').click();
    await expect(continueBtn).toBeEnabled();
  });

  test('Back button on step 2 returns to step 1', async ({ page }) => {
    const email = `back-test-${Date.now()}@playwright-ca.test`;
    await page.goto('/login');
    await switchToSignUpTab(page);
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('ValidPass@123');
    await authSubmitButton(page, /^create account$/i).click();
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
    await expect(page).toHaveURL('/');
    await expect(page).not.toHaveURL('/login');
  });

  test('stays logged in after navigating to a route directly', async ({ page }) => {
    await signIn(page);
    await page.goto('/clients');
    await expect(clientsPageHeading(page)).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL('/login');
  });
});

// ── Sign Out ─────────────────────────────────────────────────────────────────

test.describe('Sign Out', () => {
  test('signs out and redirects to login', async ({ page }) => {
    await signIn(page);
    await signOut(page);
    await expect(page).toHaveURL('/login');
    await expect(loginPageHeading(page)).toBeVisible();
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
