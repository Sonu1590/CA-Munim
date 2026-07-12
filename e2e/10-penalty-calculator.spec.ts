/**
 * e2e/10-penalty-calculator.spec.ts
 *
 * Tests the Penalty Calculator:
 * - Protected access and page layout
 * - Conditional fields per filing type (nil return, income <= 5L, shortfall)
 * - Advance Tax Shortfall: fully deterministic, DB-independent calculation
 *   (1% x shortfall x months late) — exact amount asserted
 * - GST filing: result renders using live compliance_rules data — only
 *   structural assertions (some amount, correct days-late), since the
 *   underlying rule values are DB-owned and already covered by
 *   ComplianceRules.test.ts (see ISSUES.md H6)
 * - FY hint, navigation, and mobile layout
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';
import {
  penaltyCalculatorHeading,
  goToPenaltyCalculator,
  waitForPenaltyCalculatorPage,
  selectFilingType,
  pickDueDate,
  pickActualDate,
  estimatedPenaltyCard,
} from './helpers/penaltyCalculator';

test.describe('Penalty Calculator - access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/penalty-calculator');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user', async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
    await expect(page).toHaveURL('/penalty-calculator');
    await expect(penaltyCalculatorHeading(page)).toBeVisible();
  });
});

test.describe('Penalty Calculator - page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
  });

  test('shows header, disclaimer, and filing details form', async ({ page }) => {
    await expect(penaltyCalculatorHeading(page)).toBeVisible();
    await expect(page.getByText(/estimate late filing penalties/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filing Details' })).toBeVisible();
    await expect(page.getByText('Filing Type', { exact: true })).toBeVisible();
    await expect(page.getByText('Original Due Date', { exact: true })).toBeVisible();
    await expect(page.getByText('Actual Filing Date', { exact: true })).toBeVisible();
    await expect(page.getByText('Pick due date')).toBeVisible();
    await expect(page.getByText('Pick actual date')).toBeVisible();
  });

  test('no result card until filing type and both dates are chosen', async ({ page }) => {
    await expect(estimatedPenaltyCard(page)).not.toBeVisible();
    await selectFilingType(page, 'GSTR-3B (Monthly)');
    await expect(estimatedPenaltyCard(page)).not.toBeVisible();
    await pickDueDate(page, '1');
    await expect(estimatedPenaltyCard(page)).not.toBeVisible();
  });
});

test.describe('Penalty Calculator - conditional fields', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
  });

  test('GST filing types show the nil-return checkbox and turnover field', async ({ page }) => {
    await selectFilingType(page, 'GSTR-3B (Monthly)');
    await expect(page.getByText(/this is a nil return/i)).toBeVisible();
    await expect(page.getByText('Annual Turnover (₹)')).toBeVisible();

    // Checking "nil return" hides the turnover input.
    await page.getByLabel(/this is a nil return/i).check();
    await expect(page.getByText('Annual Turnover (₹)')).not.toBeVisible();
  });

  test('ITR shows the income <= 5L checkbox, not the GST fields', async ({ page }) => {
    await selectFilingType(page, 'ITR (Income Tax Return)');
    await expect(page.getByText(/total income.*5 lakh/i)).toBeVisible();
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
  });

  test('Advance Tax Shortfall shows the shortfall input, no GST/ITR fields', async ({ page }) => {
    await selectFilingType(page, 'Advance Tax Shortfall');
    await expect(page.getByText('Actual Tax Shortfall (₹)')).toBeVisible();
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
    await expect(page.getByText(/total income.*5 lakh/i)).not.toBeVisible();
  });

  test('ROC filing shows none of the conditional fields', async ({ page }) => {
    await selectFilingType(page, 'ROC Annual Filing (AOC-4 / MGT-7)');
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
    await expect(page.getByText(/total income.*5 lakh/i)).not.toBeVisible();
    await expect(page.getByText('Actual Tax Shortfall (₹)')).not.toBeVisible();
  });
});

test.describe('Penalty Calculator - advance tax (deterministic)', () => {
  test('computes 1% x shortfall x months late exactly', async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);

    await selectFilingType(page, 'Advance Tax Shortfall');
    await page.getByPlaceholder('e.g. 45000').fill('50000');
    // Same calendar month, 19 days apart => daysLate=19, months=ceil(19/30)=1
    // amount = round(50000 * 0.01 * 1) = 500 — independent of any DB rule.
    await pickDueDate(page, '1');
    await pickActualDate(page, '20');

    const card = estimatedPenaltyCard(page);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText('500', { exact: true })).toBeVisible();
    await expect(card.getByText('19', { exact: true })).toBeVisible();
    await expect(card.getByText(/1% × ₹50,000 × 1 month/)).toBeVisible();
    await expect(card.getByText('234B/234C')).toBeVisible();
  });
});

test.describe('Penalty Calculator - GST filing', () => {
  test('renders a penalty estimate for a late GSTR-3B filing', async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);

    await selectFilingType(page, 'GSTR-3B (Monthly)');
    await page.getByPlaceholder('e.g. 8000000').fill('1000000');
    await pickDueDate(page, '1');
    await pickActualDate(page, '20');

    const card = estimatedPenaltyCard(page);
    // Compliance rules load async with no visible spinner — allow extra time.
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText('Days late:')).toBeVisible();
    await expect(card.getByText('19', { exact: true })).toBeVisible();
    await expect(page.getByText('₹').first()).toBeVisible();
    await expect(page.getByText(/disclaimer/i)).toBeVisible();
  });
});

test.describe('Penalty Calculator - FY hint', () => {
  test('shows the financial year the picked due date falls in', async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
    await selectFilingType(page, 'ROC Annual Filing (AOC-4 / MGT-7)');
    await pickDueDate(page, '15');
    await expect(page.getByText(/falls in/i)).toBeVisible();
    // Scoped to <main> — the sidebar also shows an "FY 2026-27"-style badge.
    await expect(page.getByRole('main').getByText(/FY \d{4}-\d{2}/)).toBeVisible();
  });
});

test.describe('Penalty Calculator - mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('form remains usable on a small screen', async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
    await expect(penaltyCalculatorHeading(page)).toBeVisible();
    await selectFilingType(page, 'TDS Return (24Q / 26Q)');
    await pickDueDate(page, '1');
    await pickActualDate(page, '10');
    await expect(estimatedPenaltyCard(page)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Penalty Calculator - navigation', () => {
  test('sidebar Penalty Calculator link navigates to the page', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Penalty Calculator' }).click();
    await expect(page).toHaveURL('/penalty-calculator');
    await waitForPenaltyCalculatorPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
    await page.reload();
    await waitForPenaltyCalculatorPage(page);
    await expect(penaltyCalculatorHeading(page)).toBeVisible();
  });
});
