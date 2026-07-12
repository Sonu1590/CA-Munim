/**
 * e2e/helpers/settings.ts
 * Navigation helpers for the Settings module
 */
import { Page, expect } from '@playwright/test';
import { waitForLoading } from './auth';

export type SettingsTabName =
  | 'Firm Profile' | 'Staff' | 'WhatsApp' | 'Compliance' | 'Invoice'
  | 'Updates' | 'Plans' | 'Export' | 'Audit Trail';

export function settingsPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'Settings', exact: true });
}

export function settingsTab(page: Page, name: SettingsTabName) {
  return page.getByRole('tab', { name, exact: true });
}

export async function goToSettings(page: Page, tab?: SettingsTabName) {
  await page.goto('/settings');
  await waitForSettingsPage(page);
  if (tab) {
    await settingsTab(page, tab).click();
  }
}

export async function waitForSettingsPage(page: Page) {
  await expect(settingsPageHeading(page)).toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}
