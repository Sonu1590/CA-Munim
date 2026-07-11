/**
 * e2e/helpers/reports.ts
 * Navigation and interaction helpers for the Reports module
 */
import { Page, expect } from '@playwright/test';
import { waitForLoading } from './auth';

export type ReportTabName =
  | 'Compliance'
  | 'Pending Work'
  | 'FY Summary'
  | 'Receivables Aging'
  | 'Client Ledger'
  | 'Compliance Calendar'
  | 'Staff Productivity';

export function reportsPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'Reports', exact: true });
}

export function reportTab(page: Page, name: ReportTabName) {
  return page.getByRole('tab', { name, exact: true });
}

export async function goToReports(page: Page, tab?: ReportTabName) {
  await page.goto('/reports');
  await waitForReportsPage(page);
  if (tab) {
    await reportTab(page, tab).click();
  }
}

export async function waitForReportsPage(page: Page) {
  await expect(reportsPageHeading(page)).toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}

/** Card title inside the currently active tabpanel. */
export function activeReportTitle(page: Page, title: string) {
  return page.getByRole('heading', { name: title, exact: true });
}
