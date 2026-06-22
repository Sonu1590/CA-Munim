/**
 * e2e/05-billing.spec.ts
 *
 * Tests Billing & Fees:
 * - Protected access and page layout
 * - Invoice search and status filtering
 * - Create invoice validation, line items, GST, and happy path
 * - Fees dashboard and reminders
 * - Record payment validation
 * - Mobile layout, navigation, and refresh
 */

import { test, expect } from '@playwright/test';
import { signIn, expectToast } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import {
  goToBilling,
  waitForBillingPage,
  billingPageHeading,
  billingSearchInput,
  billingStatusFilter,
  invoiceDialog,
  invoiceRow,
  openCreateInvoiceModal,
  fillInvoiceForm,
  createInvoiceForClient,
  filterInvoicesByStatus,
} from './helpers/billing';

test.describe('Billing - access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/billing');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user', async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
    await expect(page).toHaveURL('/billing');
    await expect(billingPageHeading(page)).toBeVisible();
  });
});

test.describe('Billing - page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
  });

  test('shows header, tabs, filters, and create action', async ({ page }) => {
    await expect(billingPageHeading(page)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Invoices' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Fees Dashboard' })).toBeVisible();
    await expect(billingSearchInput(page)).toBeVisible();
    await expect(billingStatusFilter(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible();
  });

  test('shows invoice count badge', async ({ page }) => {
    const badge = billingPageHeading(page).locator('..').locator('[class*="badge"], .rounded-full').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/^\d+$/);
  });

  test('shows desktop invoice columns or the empty state', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1280) < 768) test.skip(true, 'Desktop viewport required for table');

    if ((await page.locator('table tbody tr').count()) === 0) {
      await expect(page.getByText(/No invoices found/)).toBeVisible();
      return;
    }

    for (const heading of ['Invoice No', 'Client', 'Date', 'Amount', 'GST', 'Total', 'Status', 'Actions']) {
      await expect(page.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();
    }
  });

  test('does not show loading state after data loads', async ({ page }) => {
    await expect(page.getByText('Loading invoices...')).not.toBeVisible();
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Billing - create invoice modal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
    await openCreateInvoiceModal(page);
  });

  test('shows client, invoice, line item, tax, and send controls', async ({ page }) => {
    const dialog = invoiceDialog(page);
    await expect(dialog.getByText('Select client', { exact: true })).toBeVisible();
    await expect(dialog.getByPlaceholder(/Description \(e\.g\., ITR Filing/)).toBeVisible();
    await expect(dialog.getByPlaceholder('SAC Code')).toHaveValue('998231');
    await expect(dialog.getByPlaceholder(/Amount/)).toBeVisible();
    await expect(dialog.getByText('Apply GST (18%)')).toBeVisible();
    await expect(dialog.getByText('Send via WhatsApp')).toBeVisible();
    await expect(dialog.getByText('Send via Email')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add Row' })).toBeVisible();
  });

  test('requires a client before creating', async ({ page }) => {
    const dialog = invoiceDialog(page);
    await dialog.getByPlaceholder(/Description \(e\.g\., ITR Filing/).fill('ITR Filing');
    await dialog.getByPlaceholder(/Amount/).fill('1000');
    await dialog.getByRole('button', { name: 'Create Invoice', exact: true }).click();
    await expectToast(page, 'Please select a client');
    await expect(dialog).toBeVisible();
  });

  test('adds and removes line-item rows', async ({ page }) => {
    const dialog = invoiceDialog(page);
    await dialog.getByRole('button', { name: 'Add Row' }).click();
    await expect(dialog.getByPlaceholder(/Description \(e\.g\., ITR Filing/)).toHaveCount(2);

    const secondLineItem = dialog
      .getByPlaceholder(/Description \(e\.g\., ITR Filing/)
      .nth(1)
      .locator('xpath=ancestor::div[contains(@class,"items-start")][1]');
    const removeButton = secondLineItem.getByRole('button');
    await expect(removeButton).toBeEnabled();
    await removeButton.click();
    await expect(dialog.getByPlaceholder(/Description \(e\.g\., ITR Filing/)).toHaveCount(1);
  });

  test('calculates GST and grand total from line amount', async ({ page }) => {
    const dialog = invoiceDialog(page);
    await dialog.getByPlaceholder(/Amount/).fill('1000');
    await expect(dialog.getByText('₹1,000', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText('₹1,180', { exact: true })).toBeVisible();
  });

  test('cancel closes the modal', async ({ page }) => {
    await invoiceDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(invoiceDialog(page)).not.toBeVisible();
  });
});

test.describe('Billing - invoice workflow', () => {
  test('creates an invoice and finds it by client and Draft status', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToBilling(page);
    await createInvoiceForClient(page, client.name, {
      description: 'Playwright ITR Filing',
      amount: '2500',
      notes: 'Payment due within 15 days',
    });

    await expectToast(page, /invoice created successfully/i, 20_000);
    await waitForBillingPage(page);
    await billingSearchInput(page).fill(client.name);
    await expect(invoiceRow(page, client.name)).toBeVisible({ timeout: 15_000 });
    await expect(invoiceRow(page, client.name).getByText('Draft', { exact: true })).toBeVisible();

    await filterInvoicesByStatus(page, 'Draft');
    await expect(invoiceRow(page, client.name)).toBeVisible();
    await filterInvoicesByStatus(page, 'Paid');
    await expect(page.getByText(/No invoices found/)).toBeVisible();
  });

  test('searching for an unknown invoice shows the empty result', async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
    await billingSearchInput(page).fill('INV-NOT-FOUND-987654');
    await expect(page.getByText(/No invoices found/)).toBeVisible();
  });
});

test.describe('Billing - payment', () => {
  test('opens payment modal and validates the amount', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1280) < 768) test.skip(true, 'Desktop invoice actions required');

    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);
    await goToBilling(page);
    await createInvoiceForClient(page, client.name, { amount: '1000' });
    await expectToast(page, /invoice created successfully/i, 20_000);
    await waitForBillingPage(page);
    await billingSearchInput(page).fill(client.name);

    const row = invoiceRow(page, client.name);
    await expect(row).toBeVisible();
    await row.locator('button:has(svg.lucide-credit-card)').click();
    await expect(invoiceDialog(page).getByRole('heading', { name: 'Record Payment' })).toBeVisible();

    await invoiceDialog(page).getByRole('button', { name: 'Record Payment' }).click();
    await expectToast(page, 'Enter a valid amount');
  });
});

test.describe('Billing - fees dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
    await page.getByRole('tab', { name: 'Fees Dashboard' }).click();
  });

  test('shows fee metrics and outstanding invoices', async ({ page }) => {
    await expect(page.getByText('Invoiced This Month')).toBeVisible();
    await expect(page.getByText('Received This Month')).toBeVisible();
    await expect(page.getByText('Total Outstanding')).toBeVisible();
    await expect(page.getByText('Overdue Invoices')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Outstanding Invoices' })).toBeVisible();
  });

  test('reminder reports success when an outstanding invoice exists', async ({ page }) => {
    const reminder = page.getByRole('button', { name: 'Send Reminder' }).first();
    if ((await reminder.count()) === 0) test.skip(true, 'No outstanding invoice exists');
    await reminder.click();
    await expectToast(page, /reminder sent to/i);
  });
});

test.describe('Billing - mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('uses invoice cards instead of the desktop table', async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
    await expect(page.locator('table')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible();
    await expect(billingSearchInput(page)).toBeVisible();
  });
});

test.describe('Billing - navigation', () => {
  test('sidebar Billing & Fees link navigates to billing', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Billing & Fees' }).click();
    await expect(page).toHaveURL('/billing');
    await waitForBillingPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
    await page.reload();
    await waitForBillingPage(page);
    await expect(billingPageHeading(page)).toBeVisible();
  });
});
