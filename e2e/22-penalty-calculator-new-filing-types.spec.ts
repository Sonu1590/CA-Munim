/**
 * e2e/22-penalty-calculator-new-filing-types.spec.ts
 *
 * The 7 filing types added when H6 was fully closed (CMP-08, Tax Audit,
 * TDS Challan, Form 16, ADT-1, INC-20A, PAS-3 — see ISSUES.md). The original
 * 10-penalty-calculator.spec.ts predates them, so their conditional inputs and
 * computation were untested end-to-end. Each type maps to a distinct penalty
 * shape (interest / flat-% / compound / capital-slab), surfaced by a different
 * conditional field.
 *
 * The calculator is read-only (it never writes to the DB), so these are safe
 * against the shared test project. Exact rupee amounts are DB-owned
 * (compliance_rules) and already covered by ComplianceRules.test.ts, so — like
 * the existing GST test — the computation assertions here are structural
 * (section label, days late, the frontend breakdown wording), not exact
 * amounts.
 */
import { test, expect } from './helpers/coverage';
import { signIn } from './helpers/auth';
import {
  goToPenaltyCalculator,
  selectFilingType,
  pickDueDate,
  pickActualDate,
  estimatedPenaltyCard,
} from './helpers/penaltyCalculator';

test.describe('Penalty Calculator - new filing types (H6): conditional fields', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
  });

  test('CMP-08 shows Composition Tax Payable (interest u/s 50), not the GST fields', async ({ page }) => {
    await selectFilingType(page, 'CMP-08 (Composition Quarterly)');
    await expect(page.getByText('Composition Tax Payable (₹)')).toBeVisible();
    await expect(page.getByText(/interest u\/s 50/i)).toBeVisible();
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
    await expect(page.getByText('Annual Turnover (₹)')).not.toBeVisible();
  });

  test('Tax Audit shows Annual Turnover with the 271B hint, not the nil checkbox', async ({ page }) => {
    await selectFilingType(page, 'Tax Audit Report (Form 3CD)');
    await expect(page.getByText('Annual Turnover (₹)')).toBeVisible();
    await expect(page.getByText(/Sec 271B penalty is 0\.5% of turnover/i)).toBeVisible();
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
  });

  test('TDS Challan shows TDS Amount with the 201(1A) interest hint', async ({ page }) => {
    await selectFilingType(page, 'TDS Challan (Late Deposit)');
    await expect(page.getByText('TDS Amount (₹)')).toBeVisible();
    await expect(page.getByText(/Interest u\/s 201\(1A\)/i)).toBeVisible();
  });

  test('Form 16 shows TDS Amount with the capped-at-TDS hint', async ({ page }) => {
    await selectFilingType(page, 'Form 16 (TDS Certificate)');
    await expect(page.getByText('TDS Amount (₹)')).toBeVisible();
    await expect(page.getByText(/capped at the total TDS amount/i)).toBeVisible();
  });

  test('ADT-1 shows Nominal Share Capital', async ({ page }) => {
    await selectFilingType(page, 'ADT-1 (Auditor Appointment)');
    await expect(page.getByText('Nominal Share Capital (₹)')).toBeVisible();
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
  });

  test('INC-20A needs no extra conditional input', async ({ page }) => {
    await selectFilingType(page, 'INC-20A (Commencement of Business)');
    await expect(page.getByText('Composition Tax Payable (₹)')).not.toBeVisible();
    await expect(page.getByText('Nominal Share Capital (₹)')).not.toBeVisible();
    await expect(page.getByText('Annual Turnover (₹)')).not.toBeVisible();
    await expect(page.getByText('TDS Amount (₹)')).not.toBeVisible();
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
  });

  test('PAS-3 needs no extra conditional input', async ({ page }) => {
    await selectFilingType(page, 'PAS-3 (Return of Allotment)');
    await expect(page.getByText('Nominal Share Capital (₹)')).not.toBeVisible();
    await expect(page.getByText('TDS Amount (₹)')).not.toBeVisible();
    await expect(page.getByText('Composition Tax Payable (₹)')).not.toBeVisible();
    await expect(page.getByText(/this is a nil return/i)).not.toBeVisible();
  });
});

test.describe('Penalty Calculator - new filing types (H6): computation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToPenaltyCalculator(page);
  });

  // INC-20A takes no extra input, so the two dates alone produce a result.
  // due=1, actual=20 same month => 19 days late (deterministic, DB-independent).
  test('INC-20A produces a Section 10A penalty from the picked dates', async ({ page }) => {
    await selectFilingType(page, 'INC-20A (Commencement of Business)');
    await pickDueDate(page, '1');
    await pickActualDate(page, '20');
    const card = estimatedPenaltyCard(page);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText('19', { exact: true })).toBeVisible();
    await expect(card.getByText(/Section 10A/)).toBeVisible();
    // Frontend breakdown wording (not a DB amount).
    await expect(card.getByText(/Company ₹/)).toBeVisible();
  });

  test('ADT-1 computes an MCA additional fee from the nominal capital', async ({ page }) => {
    await selectFilingType(page, 'ADT-1 (Auditor Appointment)');
    await page.getByPlaceholder('e.g. 1000000').fill('1000000');
    await pickDueDate(page, '1');
    await pickActualDate(page, '20');
    const card = estimatedPenaltyCard(page);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/Section 139/)).toBeVisible();
    // Breakdown-specific wording (the words "additional fee" also appear in the
    // section label above, so match the unambiguous "Normal fee ₹…" line).
    await expect(card.getByText(/Normal fee ₹/)).toBeVisible();
  });

  test('CMP-08 computes interest on the composition tax entered', async ({ page }) => {
    await selectFilingType(page, 'CMP-08 (Composition Quarterly)');
    await page.getByPlaceholder('e.g. 25000').fill('25000');
    await pickDueDate(page, '1');
    await pickActualDate(page, '20');
    const card = estimatedPenaltyCard(page);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/Section 50 of CGST Act/)).toBeVisible();
    // "@" anchors to the breakdown ("Interest @18% p.a. …"); the word "interest"
    // alone also appears in the section badge and disclaimer.
    await expect(card.getByText(/Interest @/)).toBeVisible();
  });
});
