/**
 * e2e/19-billing-record-payment-integrity.spec.ts
 *
 * ISSUES.md C5 (fixed): RecordPaymentModal previously showed a real-looking
 * success toast and closed the dialog without ever calling useBilling's
 * recordPayment() — no payments row was inserted and the invoice's status
 * never changed. Now wired through properly; this test reloads the page
 * after a "successful" payment to bypass any client-side optimistic state
 * and confirm the real row was actually updated, not just the UI.
 */
import { test, expect } from './helpers/coverage';
import { signIn } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import { goToBilling, createInvoiceForClient, invoiceRow, billingSearchInput, invoiceDialog, waitForBillingPage } from './helpers/billing';

test.describe('Billing - Record Payment persists (C5)', () => {
  test('a full payment shows a Paid toast and the invoice is Paid after reload', async ({ page }) => {
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

    await expect(page.getByText(/full payment of ₹1,180 recorded — invoice marked as paid/i)).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // Reload to bypass any client-side optimistic state and re-fetch the
    // real row from Supabase — confirms the write actually happened.
    await page.reload();
    await waitForBillingPage(page);
    await billingSearchInput(page).fill(client.name);
    const rowAfterReload = invoiceRow(page, client.name);
    await expect(rowAfterReload).toBeVisible({ timeout: 10_000 });
    await expect(rowAfterReload.getByText('Paid', { exact: true })).toBeVisible();
    await expect(rowAfterReload.getByText('Draft', { exact: true })).not.toBeVisible();
  });
});
