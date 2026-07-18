/**
 * e2e/16-billing-validation-edge-cases.spec.ts
 *
 * Form-validation edge cases in Create Invoice not already covered by
 * 05-billing.spec.ts (which tests the "empty description/amount" and
 * "no client selected" cases, but not a *filled-in* invalid amount).
 *
 * Created invoices are left in place afterward, same as 05-billing.spec.ts's
 * own convention (no delete UI exists for invoices, unlike
 * clients/templates/staff elsewhere in this suite).
 */
import { test, expect } from './helpers/coverage';
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

  // ISSUES.md M18 (fixed): handleSubmit now checks Number(li.amount) > 0
  // explicitly, not just truthiness on the raw string — a ₹0 line item
  // (or negative/non-numeric) is rejected with an error toast and no
  // invoice is created.
  test('a zero amount line item is rejected with a validation error (M18)', async ({ page }) => {
    const client = await createClient(page);
    await goToBilling(page);
    await openCreateInvoiceModal(page);
    await selectInvoiceClient(page, client.name);
    await invoiceDialog(page).getByPlaceholder(/Description \(e\.g\., ITR Filing/).first().fill('Zero amount line item');
    await invoiceDialog(page).getByPlaceholder(/Amount/).first().fill('0');
    await invoiceDialog(page).getByRole('button', { name: 'Create Invoice', exact: true }).click();

    await expectToast(page, /each line item amount must be greater than/i, 15_000);
    // Modal stays open — no invoice was created.
    await expect(invoiceDialog(page)).toBeVisible();

    await invoiceDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await billingSearchInput(page).fill(client.name);
    await expect(invoiceRow(page, client.name)).not.toBeVisible({ timeout: 5_000 });
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
