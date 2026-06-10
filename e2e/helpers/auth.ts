/**
 * e2e/helpers/auth.ts
 * Resilient selectors — works regardless of exact label/button text
 */
import { Page, expect } from '@playwright/test';

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? 'djlnscaq@sharklasers.com',
  password: process.env.TEST_USER_PASSWORD ?? 'TestUser@2026',
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

export async function signIn(
  page: Page,
  email = TEST_USER.email,
  password = TEST_USER.password
) {
  await page.goto('/login');

  await expect(
    page.getByText('CA Munim').first()
  ).toBeVisible({ timeout: 10_000 });

  const signInTab = page
    .getByRole('button', { name: /^sign.?in$/i })
    .first();

  if (await signInTab.isVisible()) {
    await signInTab.click();
  }

  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill(email);

  const passwordInput = page
    .locator('input[type="password"]')
    .first();

  await passwordInput.fill(password);

  await page
    .locator('form')
    .getByRole('button', {
      name: /^sign.?in$/i,
    })
    .click();

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
  const toast = page
    .getByText(text)
    .first();

  await expect(toast).toBeVisible({
    timeout,
  });
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