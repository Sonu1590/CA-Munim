/**
 * e2e/08-reports.spec.ts
 *
 * Tests Reports module — one tab per report, all client-side/DB-only (the
 * Download/Export buttons build a Blob locally, no network calls beyond the
 * initial read, so they're safe to actually click and verify):
 * - Compliance Status, Pending Work, FY Summary, Receivables Aging,
 *   Client Ledger, Compliance Calendar, Staff Productivity
 * - Tab switching, mobile short labels, navigation, and refresh
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';
import {
  reportsPageHeading,
  reportTab,
  goToReports,
  waitForReportsPage,
} from './helpers/reports';

test.describe('Reports - access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user on the Compliance tab by default', async ({ page }) => {
    await signIn(page);
    await goToReports(page);
    await expect(page).toHaveURL('/reports');
    await expect(reportsPageHeading(page)).toBeVisible();
    await expect(reportTab(page, 'Compliance')).toHaveAttribute('data-state', 'active');
  });
});

test.describe('Reports - page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToReports(page);
  });

  test('shows header and all seven report tabs', async ({ page }) => {
    await expect(reportsPageHeading(page)).toBeVisible();
    await expect(page.getByText('Generate & export practice reports')).toBeVisible();
    for (const tab of [
      'Compliance', 'Pending Work', 'FY Summary', 'Receivables Aging',
      'Client Ledger', 'Compliance Calendar', 'Staff Productivity',
    ] as const) {
      await expect(reportTab(page, tab)).toBeVisible();
    }
  });
});

test.describe('Reports - compliance status', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToReports(page);
  });

  test('shows FY selector, export button, and a status table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Client Compliance Status' })).toBeVisible();
    await expect(page.getByText('Loading compliance data...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^export$/i })).toBeEnabled();
    // The table (with headers) always renders once loaded, even with 0 rows
    // — unlike the other reports, there's no separate empty-state message.
    await expect(page.getByRole('columnheader', { name: 'Client' })).toBeVisible();
  });

  test('downloads a CSV export', async ({ page }) => {
    await expect(page.getByText('Loading compliance data...')).not.toBeVisible({ timeout: 10_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /^export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^client-compliance-status-.*\.csv$/);
  });
});

test.describe('Reports - pending work', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToReports(page, 'Pending Work');
  });

  test('shows filter buttons and export action', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pending Work Report' })).toBeVisible();
    await expect(page.getByText('Loading tasks...')).not.toBeVisible({ timeout: 10_000 });
    for (const label of ['All Open', 'Due This Week', 'Due This Month', 'Overdue']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /export pdf/i })).toBeEnabled();
  });

  test('switching filters does not crash and shows a result or empty state', async ({ page }) => {
    await page.getByRole('button', { name: 'Overdue', exact: true }).click();
    await expect(
      page.getByText('No pending tasks found for this filter.').or(page.locator('.divide-y').first()),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Reports - FY summary', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToReports(page, 'FY Summary');
  });

  test('shows the four metric cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Financial Year Summary' })).toBeVisible();
    await expect(page.getByText('Loading financial summary...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Filings Completed')).toBeVisible();
    await expect(page.getByText('Total Invoiced')).toBeVisible();
    await expect(page.getByText('Total Collected')).toBeVisible();
  });
});

test.describe('Reports - receivables aging', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToReports(page, 'Receivables Aging');
  });

  test('shows summary cards and either the client table or the empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Receivables Aging' })).toBeVisible();
    await expect(page.getByText('Loading receivables aging...')).not.toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Total Outstanding').or(page.getByText('No outstanding receivables')),
    ).toBeVisible();
  });

  test('downloads the report when there is outstanding data', async ({ page }) => {
    await expect(page.getByText('Loading receivables aging...')).not.toBeVisible({ timeout: 10_000 });
    const downloadBtn = page.getByRole('button', { name: /^download$/i });
    if (await downloadBtn.isDisabled()) {
      test.skip(true, 'No outstanding receivables to export');
    }
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);
    expect(download.suggestedFilename()).toBe('receivables-aging.html');
  });
});

test.describe('Reports - client ledger', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToReports(page, 'Client Ledger');
  });

  test('auto-selects the first client and shows ledger or the empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Client Ledger' })).toBeVisible();
    await expect(page.getByText('Loading client ledger...')).not.toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('No invoices or payments found for this client.').or(page.getByRole('columnheader', { name: 'Date' })),
    ).toBeVisible();
  });

  test('switching client reloads the ledger', async ({ page }) => {
    await expect(page.getByText('Loading client ledger...')).not.toBeVisible({ timeout: 10_000 });
    const select = page.getByRole('tabpanel', { name: 'Client Ledger' }).getByRole('combobox');
    await select.click();
    const options = page.getByRole('option');
    const count = await options.count();
    if (count < 2) {
      test.skip(true, 'Fewer than 2 clients exist to switch between');
    }
    await options.nth(1).click();
    await expect(page.getByText('Loading client ledger...')).not.toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Reports - compliance calendar', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToReports(page, 'Compliance Calendar');
  });

  test('PDF export is disabled until a client is selected, then shows 12 month buckets', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Compliance Calendar' })).toBeVisible();
    await expect(page.getByText('Loading clients...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^pdf$/i })).toBeDisabled();
    await expect(page.getByText('Select a client to view scheduled tasks')).toBeVisible();

    const clientSelect = page.getByText('Select client', { exact: true });
    const hasClients = await clientSelect.isVisible().catch(() => false);
    if (!hasClients) {
      test.skip(true, 'No clients exist to select');
    }
    await clientSelect.click();
    const firstOption = page.getByRole('option').first();
    if ((await firstOption.count()) === 0) {
      test.skip(true, 'No clients exist to select');
    }
    await firstOption.click();

    await expect(page.getByText('Loading compliance tasks...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^pdf$/i })).toBeEnabled();
    for (const month of ['April', 'May', 'June', 'July', 'August', 'September']) {
      await expect(page.getByText(month, { exact: true })).toBeVisible();
    }
  });
});

test.describe('Reports - staff productivity', () => {
  test('shows a per-staff breakdown or the empty state', async ({ page }) => {
    await signIn(page);
    await goToReports(page, 'Staff Productivity');
    await expect(page.getByRole('heading', { name: 'Staff Productivity' })).toBeVisible();
    await expect(page.getByText('Loading staff productivity...')).not.toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('No staff productivity data available.').or(page.locator('[role="progressbar"]').first()),
    ).toBeVisible();
  });
});

test.describe('Reports - mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tabs show short labels and remain switchable', async ({ page }) => {
    await signIn(page);
    await goToReports(page);
    await expect(page.getByRole('tab', { name: 'Aging', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Aging', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Receivables Aging' })).toBeVisible();
  });
});

test.describe('Reports - navigation', () => {
  test('sidebar Reports link navigates to the page', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL('/reports');
    await waitForReportsPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToReports(page);
    await page.reload();
    await waitForReportsPage(page);
    await expect(reportsPageHeading(page)).toBeVisible();
  });
});
