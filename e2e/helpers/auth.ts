/**
 * e2e/helpers/auth.ts
 * Resilient selectors — works regardless of exact label/button text
 */
import { Page, expect } from '@playwright/test';

function requireTestEnv(name: 'TEST_USER_EMAIL' | 'TEST_USER_PASSWORD'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy e2e/.env.test.example to e2e/.env.test (or export ` +
      `${name} in your shell/CI secrets) with credentials for a real test account ` +
      `before running e2e tests.`
    );
  }
  return value;
}

export const TEST_USER = {
  get email() { return requireTestEnv('TEST_USER_EMAIL'); },
  get password() { return requireTestEnv('TEST_USER_PASSWORD'); },
};

export const TEST_CLIENT = {
  name: 'Playwright Test Client',
  pan: 'ABCPT1234K',
  phone: '9876543210',
  email: 'testclient@playwright.test',
  city: 'Pune',
  state: 'Maharashtra',
  type: 'Individual',
};

export const TEST_CLIENT_2 = {
  name: 'Playwright Firm Test',
  pan: 'AABCP5678M',
  phone: '9123456789',
  email: 'firmtest@playwright.test',
  city: 'Mumbai',
  state: 'Maharashtra',
  type: 'Private Ltd',
};

export const TEST_TASK = {
  type: 'GSTR-3B',
  financialYear: 'FY 2025-26',
  period: 'April',
  priority: 'high',
};

export const TEST_INVOICE = {
  description: 'ITR Filing FY 2025-26',
  amount: '5000',
};

/** Mode tab above the auth form (type="button"), not the form submit control. */
export function authModeTab(page: Page, name: RegExp) {
  return page
    .getByRole('button', { name })
    .and(page.locator('button[type="button"]'));
}

/** Form submit button for the active auth mode. */
export function authSubmitButton(page: Page, name: RegExp) {
  return page.locator('form').getByRole('button', { name });
}

export async function switchToSignUpTab(page: Page) {
  await authModeTab(page, /^create account$/i).click();
  await expect(authSubmitButton(page, /^create account$/i)).toBeVisible();
}

export async function switchToSignInTab(page: Page) {
  await authModeTab(page, /^sign.?in$/i).click();
  await expect(authSubmitButton(page, /^sign.?in$/i)).toBeVisible();
}

export function loginPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'CA Munim' });
}

export async function fillSignUpForm(
  page: Page,
  options: { email: string; password: string; fullName?: string },
) {
  const { email, password, fullName = 'Playwright Test User' } = options;
  await page.getByLabel('Your Name').fill(fullName);
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
}

/** Submit sign-up and wait for the Supabase auth API response. */
export async function submitSignUp(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/auth/v1/signup') && r.request().method() === 'POST',
      { timeout: 20_000 },
    ),
    authSubmitButton(page, /^create account$/i).click(),
  ]);
  return response;
}

/** Supabase may return 200 with an empty identities array for duplicate signups. */
export function isObfuscatedDuplicateSignUp(body: { user?: { identities?: unknown[] } }) {
  return (
    Array.isArray(body?.user?.identities) &&
    body.user!.identities!.length === 0
  );
}

export function uniqueSignUpEmail(prefix = 'pw-signup') {
  const domain = TEST_USER.email.split('@')[1] ?? 'sharklasers.com';
  return `${prefix}-${Date.now()}@${domain}`;
}

export async function signIn(
  page: Page,
  email = TEST_USER.email,
  password = TEST_USER.password
) {
  await page.goto('/login');

  await expect(
    page.getByText('CA Munim').first()
  ).toBeVisible({ timeout: 10_000 });

  await switchToSignInTab(page);

  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill(email);

  const passwordInput = page
    .locator('input[type="password"]')
    .first();

  await passwordInput.fill(password);

  await authSubmitButton(page, /^sign.?in$/i).click();

  await page.waitForLoadState('networkidle');

  await expect(page).not.toHaveURL(
    /\/login$/,
    {
      timeout: 15_000,
    }
  );
}

export async function signOut(page: Page) {
  const logoutBtn = page
    .locator('[title="Sign out"]')
    .or(
      page.getByRole('button', {
        name: /sign.?out|log.?out/i,
      })
    )
    .first();

  await logoutBtn.click();

  await expect(page).toHaveURL(
    /\/login$/,
    {
      timeout: 8_000,
    }
  );
}

export async function expectToast(
  page: Page,
  text: string | RegExp,
  timeout = 10_000
) {
  const sonnerToast = page.locator('[data-sonner-toast]').filter({ hasText: text });
  const textMatch = page.getByText(text);
  await expect(sonnerToast.or(textMatch).first()).toBeVisible({ timeout });
}

export async function waitForLoading(
  page: Page,
  timeout = 15_000
) {
  try {
    await page
      .locator('.animate-spin')
      .first()
      .waitFor({
        state: 'hidden',
        timeout,
      });
  } catch {
    // spinner never appeared
  }
}

export async function openModal(
  page: Page,
  triggerText: string
): Promise<void> {
  const trigger = page
    .getByRole('button', {
      name: new RegExp(triggerText, 'i'),
    })
    .first();

  await trigger.waitFor({
    state: 'visible',
  });

  await trigger.click();

  await expect(
    page.getByRole('dialog')
  ).toBeVisible({
    timeout: 5_000,
  });
}

export async function closeModal(
  page: Page
): Promise<void> {
  const cancelBtn = page
    .getByRole('dialog')
    .getByRole('button', {
      name: /cancel|close/i,
    })
    .first();

  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await expect(
    page.getByRole('dialog')
  ).not.toBeVisible({
    timeout: 5_000,
  });
}

export async function selectByPlaceholder(
  page: Page,
  placeholder: string,
  optionText: string
) {
  await page
    .getByText(placeholder, {
      exact: false,
    })
    .first()
    .click();

  await page
    .getByRole('option', {
      name: new RegExp(optionText, 'i'),
    })
    .first()
    .click();
}