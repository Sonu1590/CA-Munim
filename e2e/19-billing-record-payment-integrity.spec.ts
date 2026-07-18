/**
 * e2e/19-billing-record-payment-integrity.spec.ts
 *
 * Documents a real, currently-unfixed CRITICAL bug — ISSUES.md C5 — rather
 * than asserting ideal behavior. Existing coverage (05-billing.spec.ts's
 * "Billing - payment" describe block) only tests the amount-validation
 * error path; nothing previously exercised an actual successful
 * submission all the way through.
 *
 * RecordPaymentModal's "Record Payment" button shows a real-looking
 * success toast ("Full payment of ₹X recorded — Invoice marked as Paid")
 * and closes the dialog, but never calls useBilling's recordPayment() —
 * no payments row is inserted and the invoice's status is never updated.
 * Same bug class as the already-documented C1 (upload portal never
 * uploads) — a feature that fully simulates success with no backing
 * write. See ISSUES.md C5 for the full writeup, including direct-DB
 * confirmation (payments count = 0, invoice status still 'draft' after a
 * "successful" full payment).
 *
 * Once C5 is fixed, this test's final assertion should flip from "still
 * shows Draft" to "now shows Paid".
 */
import { test, expect } from './helpers/coverage';
import { signIn } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import { goToBilling, createInvoiceForClient, invoiceRow, billingSearchInput, invoiceDialog, waitForBillingPage } from './helpers/billing';

test.describe('Billing - Record Payment does not persist (C5)', () => {
  test('a "successful" full payment shows a Paid toast but the invoice is still Draft after reload', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);
    await goToBilling(page);
    await createInvoiceForClient(page, client.name, { amount: '1000' });
    await expect(page.getByText(/invoice created successfully/i)).toBeVisible({ timeout: 20_000 });
    await waitForBillingPage(page);

    await billingSearchInput(page).fill(client.name);
    const row = invoiceRow(page, client.name);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText('Draft', { exact: true })).toBeVisible();

    await row.locator('button:has(svg.lucide-credit-card)').click();
    const dialog = invoiceDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Record Payment' })).toBeVisible();

    // Pay the full amount (subtotal 1000 + 18% GST = 1180).
    await dialog.locator('input[type="number"]').fill('1180');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'UPI', exact: true }).click();
    await dialog.getByRole('button', { name: 'Record Payment' }).click();

    // The UI claims success...
    await expect(page.getByText(/full payment of ₹1,180 recorded — invoice marked as paid/i)).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // ...but nothing was actually written. Reload to bypass any client-side
    // optimistic state and re-fetch the real row from Supabase.
    await page.reload();
    await waitForBillingPage(page);
    await billingSearchInput(page).fill(client.name);
    const rowAfterReload = invoiceRow(page, client.name);
    await expect(rowAfterReload).toBeVisible({ timeout: 10_000 });
    // This is the bug: it should say "Paid" and it still says "Draft".
    await expect(rowAfterReload.getByText('Draft', { exact: true })).toBeVisible();
    await expect(rowAfterReload.getByText('Paid', { exact: true })).not.toBeVisible();
  });
});
