/**
 * e2e/helpers/auth.ts
 * Shared auth helpers used across all test suites
 */
import { Page, expect } from '@playwright/test';

// ── Test credentials ─────────────────────────────────────────────────────────
// Use a dedicated test account — NEVER use your real CA account
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? 'sonusingh1590@gmail,com',
  password: process.env.TEST_USER_PASSWORD ?? 'Camunim#1590',
};

// Test client data — used across multiple suites
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

// ── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Sign in and wait for dashboard to load.
 * Call this at the start of any test that needs auth.
 */
export async function signIn(page: Page, email = TEST_USER.email, password = TEST_USER.password) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'CA Munim' })).toBeVisible();

  // Fill credentials
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for dashboard — confirms auth + onboarding complete
  await expect(page).toHaveURL('/', { timeout: 15_000 });
  await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 10_000 });
}

/**
 * Sign out from the app.
 */
export async function signOut(page: Page) {
  // Click logout button in sidebar (LogOut icon)
  const logoutBtn = page.locator('[title="Sign out"]').or(
    page.getByRole('button', { name: /sign out|logout/i })
  );
  await logoutBtn.click();
  await expect(page).toHaveURL('/login', { timeout: 8_000 });
}

/**
 * Navigate to a page and wait for it to be ready.
 */
export async function goTo(page: Page, path: string, waitForText?: string) {
  await page.goto(path);
  if (waitForText) {
    await expect(page.getByText(waitForText).first()).toBeVisible({ timeout: 10_000 });
  }
}

/**
 * Wait for a toast notification to appear.
 */
export async function expectToast(page: Page, text: string | RegExp, timeout = 8_000) {
  const toast = page.locator('[data-sonner-toast]')
    .or(page.locator('[role="status"]'))
    .filter({ hasText: text });
  await expect(toast).toBeVisible({ timeout });
}

/**
 * Select a value in a shadcn/radix Select component.
 * Clicks the trigger, then clicks the option.
 */
export async function selectOption(page: Page, triggerLabel: string, optionText: string) {
  await page.getByLabel(triggerLabel).click();
  // Radix Select renders options in a portal
  await page.getByRole('option', { name: optionText }).click();
}

/**
 * Open a Select by its placeholder text.
 */
export async function selectByPlaceholder(page: Page, placeholder: string, optionText: string) {
  await page.getByText(placeholder).click();
  await page.getByRole('option', { name: optionText }).click();
}

/**
 * Fill a date input field (input type="date").
 * Uses the YYYY-MM-DD format that HTML date inputs expect.
 */
export async function fillDate(page: Page, label: string, dateStr: string) {
  const input = page.getByLabel(label);
  await input.fill(dateStr);
  await input.press('Tab');
}

/**
 * Check that the page shows a loading spinner and it eventually disappears.
 */
export async function waitForLoadingToFinish(page: Page) {
  const spinner = page.locator('.animate-spin').first();
  if (await spinner.isVisible()) {
    await expect(spinner).not.toBeVisible({ timeout: 15_000 });
  }
}

/**
 * Get the current count from a badge (e.g. "Clients 47")
 */
export async function getBadgeCount(page: Page, label: string): Promise<number> {
  const badge = page.locator('text=' + label).locator('..').locator('span.badge, span[class*="badge"]');
  const text = await badge.textContent();
  return parseInt(text ?? '0', 10);
}
