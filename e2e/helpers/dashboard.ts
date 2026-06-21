/**
 * e2e/helpers/dashboard.ts
 * Scoped locators for the dashboard (Index) page
 */
import { Page } from '@playwright/test';

/** Metric card container located by its label text at the bottom of the card. */
export function metricCard(page: Page, label: string) {
  return page.locator('.card-shadow').filter({
    has: page.getByText(label, { exact: true }),
  });
}

/** Large value shown at the top of a metric card (e.g. ₹12,500 or 17). */
export function metricCardValue(page: Page, label: string) {
  return metricCard(page, label).locator('p.text-2xl');
}

export function dashboardSectionHeading(page: Page, name: string) {
  return page.getByRole('heading', { name, exact: true });
}

export function globalSearchDialog(page: Page) {
  return page.getByRole('dialog');
}
