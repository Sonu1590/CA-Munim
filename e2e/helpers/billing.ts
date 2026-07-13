/**
 * e2e/helpers/billing.ts
 * Navigation and interaction helpers for Billing & Fees
 */
import { Page, expect } from '@playwright/test';
import { waitForLoading } from './auth';

export function billingPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'Billing & Fees', exact: true });
}

export function billingSearchInput(page: Page) {
  return page.getByPlaceholder('Search by client or invoice number...');
}

export function billingStatusFilter(page: Page) {
  return page.getByRole('tabpanel', { name: 'Invoices' }).getByRole('combobox');
}

export function invoiceDialog(page: Page) {
  return page.getByRole('dialog');
}

export function invoiceRow(page: Page, clientName: string) {
  return page.locator('table tbody tr', { hasText: clientName });
}

export async function goToBilling(page: Page) {
  await page.goto('/billing');
  await waitForBillingPage(page);
}

export async function waitForBillingPage(page: Page) {
  await expect(billingPageHeading(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Loading invoices...')).not.toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}

export async function openCreateInvoiceModal(page: Page) {
  await page.getByRole('button', { name: 'Create Invoice', exact: true }).click();
  await expect(invoiceDialog(page)).toBeVisible();
  await expect(invoiceDialog(page).getByRole('heading', { name: 'Create Invoice' })).toBeVisible();
}

export async function selectInvoiceClient(page: Page, clientName: string) {
  await invoiceDialog(page).getByText('Select client', { exact: true }).click();
  await expect(page.getByRole('option', { name: clientName, exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('option', { name: clientName, exact: true }).click();
}

export async function fillInvoiceForm(
  page: Page,
  options: {
    clientName: string;
    description?: string;
    amount?: string;
    notes?: string;
  },
) {
  const dialog = invoiceDialog(page);
  await selectInvoiceClient(page, options.clientName);
  await dialog.getByPlaceholder(/Description \(e\.g\., ITR Filing/).first()
    .fill(options.description ?? 'Playwright Accounting Services');
  await dialog.getByPlaceholder(/Amount/).first().fill(options.amount ?? '1000');

  if (options.notes) {
    // CreateInvoiceModal split the old combined "Notes / Payment Terms" free
    // text field into a real Payment Terms <Select> plus a separate Notes
    // input (M9) — the placeholder changed accordingly.
    await dialog.getByPlaceholder('Optional note for the client').fill(options.notes);
  }
}

export async function createInvoiceForClient(
  page: Page,
  clientName: string,
  options: { description?: string; amount?: string; notes?: string } = {},
) {
  await openCreateInvoiceModal(page);
  await fillInvoiceForm(page, { clientName, ...options });
  await invoiceDialog(page).getByRole('button', { name: 'Create Invoice', exact: true }).click();
}

export async function filterInvoicesByStatus(page: Page, status: string) {
  await billingStatusFilter(page).click();
  await page.getByRole('option', { name: status, exact: true }).click();
}
