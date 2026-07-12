/**
 * e2e/helpers/penaltyCalculator.ts
 * Navigation and interaction helpers for the Penalty Calculator
 */
import { Page, expect } from '@playwright/test';
import { waitForLoading } from './auth';

export function penaltyCalculatorHeading(page: Page) {
  return page.getByRole('heading', { name: 'Penalty Calculator', exact: true });
}

export async function goToPenaltyCalculator(page: Page) {
  await page.goto('/penalty-calculator');
  await waitForPenaltyCalculatorPage(page);
}

export async function waitForPenaltyCalculatorPage(page: Page) {
  await expect(penaltyCalculatorHeading(page)).toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}

export async function selectFilingType(page: Page, label: string) {
  await page.getByText('Select filing type', { exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

/** The "Original Due Date"/"Actual Filing Date" Popover-trigger buttons
 * aren't connected to their <Label> via htmlFor/id — scope by the wrapping
 * div's label text instead, same pattern as e2e/helpers/tasks.ts. */
function dateField(page: Page, label: string) {
  return page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last();
}

/** react-day-picker shows outside days to fill the grid, so a low day
 * number (e.g. "1") can match both the current month's day and a trailing
 * day from next month. The in-month cell is always first in DOM order. */
async function pickDay(page: Page, day: string) {
  const dayCell = page.getByRole('gridcell', { name: day, exact: true }).first();
  await expect(dayCell).toBeVisible({ timeout: 5_000 });
  await dayCell.click();
  // The Popover doesn't auto-close on selection — on narrow viewports the
  // still-open calendar overlaps the next field below it and blocks clicks.
  await page.keyboard.press('Escape');
}

export async function pickDueDate(page: Page, day: string) {
  await dateField(page, 'Original Due Date').getByRole('button').click();
  await pickDay(page, day);
}

export async function pickActualDate(page: Page, day: string) {
  await dateField(page, 'Actual Filing Date').getByRole('button').click();
  await pickDay(page, day);
}

export function estimatedPenaltyCard(page: Page) {
  return page.locator('div.border-accent\\/40');
}
