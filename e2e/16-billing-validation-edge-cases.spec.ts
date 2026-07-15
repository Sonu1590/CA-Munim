/**
 * e2e/16-billing-validation-edge-cases.spec.ts
 *
 * Form-validation edge cases in Create Invoice not already covered by
 * 05-billing.spec.ts (which tests the "empty description/amount" and
 * "no client selected" cases, but not a *filled-in* invalid amount).
 *
 * Note: as of this writing one of these tests documents a real, confirmed
 * bug (ISSUES.md M18) rather than asserting ideal behavior — see the
 * comment on that test. Created invoices are left in place afterward, same
 * as 05-billing.spec.ts's own convention (no delete UI exists for
 * invoices, unlike clients/templates/staff elsewhere in this suite).
 */
import { test, expect } from '@playwright/test';
import { signIn, expectToast } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import {
  goToBilling,
  openCreateInvoiceModal,
  invoiceDialog,
  selectInvoiceClient,
  billingSearchInput,
  invoiceRow,
} from './helpers/billing';

test.describe('Billing - create invoice amount validation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
  });

  // Documents ISSUES.md M18: handleSubmit's line-item check is a truthiness
  // check on the raw amount string ("0" is truthy), not Number(amount) > 0,
  // and there's no server-side/DB check either — so a ₹0 invoice is
  // currently accepted with no error. This is a bug-documenting test, not
  // an ideal-behavior test: once M18 is fixed, this assertion should be
  // replaced with the opposite (expect a validation error, no invoice
  // created) — see the comment in ISSUES.md's M18 entry.
  test('a zero amount line item is currently accepted with no validation error (M18)', async ({ page }) => {
    const client = await createClient(page);
    await goToBilling(page);
    await openCreateInvoiceModal(page);
    await selectInvoiceClient(page, client.name);
    await invoiceDialog(page).getByPlaceholder(/Description \(e\.g\., ITR Filing/).first().fill('Zero amount line item');
    await invoiceDialog(page).getByPlaceholder(/Amount/).first().fill('0');
    await invoiceDialog(page).getByRole('button', { name: 'Create Invoice', exact: true }).click();

    await expectToast(page, /invoice created successfully/i, 15_000);
    await expect(invoiceDialog(page)).not.toBeVisible({ timeout: 8_000 });

    await billingSearchInput(page).fill(client.name);
    const row = invoiceRow(page, client.name);
    await expect(row).toBeVisible({ timeout: 10_000 });
    // Amount, GST, and Total columns all show ₹0 for this invoice.
    await expect(row.getByText('₹0', { exact: false }).first()).toBeVisible();
  });

  test('the amount input is type="number", which itself blocks non-numeric text', async ({ page }) => {
    const client = await createClient(page);
    await goToBilling(page);
    await openCreateInvoiceModal(page);
    await selectInvoiceClient(page, client.name);
    const amountInput = invoiceDialog(page).getByPlaceholder(/Amount/).first();
    // Playwright's own .fill() refuses to type non-numeric text into a
    // number input (it goes through the same browser-level filtering a
    // real user's keystrokes would) — confirm that restriction is in place
    // rather than trying to type around it.
    await expect(amountInput).toHaveAttribute('type', 'number');
    await expect(amountInput.fill('abc')).rejects.toThrow();
  });
});
