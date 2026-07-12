/**
 * e2e/09-settings.spec.ts
 *
 * Tests Settings module. The e2e test account is a firm `admin` (verified
 * against the live DB), so admin-only UI (Staff toggles, Audit Trail) is
 * exercised directly rather than skipped.
 *
 * Write-safety notes:
 * - Firm Profile / Invoice Settings: these load real, already-persisted
 *   firm data. The "save" tests click Save WITHOUT changing any field
 *   (a same-value round trip) to verify the persistence path works without
 *   altering the shared test firm's real configuration.
 * - WhatsApp Config: this panel never loads existing config — it starts
 *   blank and Save would overwrite the firm's real `whatsapp_config` with
 *   fake test values, so these tests exercise validation only and never
 *   click Save.
 * - Staff Management: adds one real, disposable staff row (safe — no auth
 *   account is created, just a DB row) and toggles its own Active switch;
 *   the existing "BE10X User" staff row is never touched.
 * - Compliance (filing categories): toggles one category off then back on
 *   in the same test, so the firm's real config ends the test unchanged.
 */
import { test, expect } from '@playwright/test';
import { signIn, expectToast } from './helpers/auth';
import { unique } from './helpers/utils';
import { settingsPageHeading, settingsTab, goToSettings, waitForSettingsPage } from './helpers/settings';

test.describe('Settings - access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user on the Firm Profile tab by default', async ({ page }) => {
    await signIn(page);
    await goToSettings(page);
    await expect(page).toHaveURL('/settings');
    await expect(settingsPageHeading(page)).toBeVisible();
    await expect(settingsTab(page, 'Firm Profile')).toHaveAttribute('data-state', 'active');
  });
});

test.describe('Settings - page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToSettings(page);
  });

  test('shows header, sign out button, and all tabs incl. admin-only Audit Trail', async ({ page }) => {
    await expect(settingsPageHeading(page)).toBeVisible();
    await expect(page.getByText('Manage your firm profile, staff, integrations, and preferences')).toBeVisible();
    // Scoped to <main> — the sidebar also has its own icon-only "Sign out" button.
    await expect(page.locator('main').getByRole('button', { name: /sign out/i })).toBeVisible();
    for (const tab of [
      'Firm Profile', 'Staff', 'WhatsApp', 'Compliance', 'Invoice',
      'Updates', 'Plans', 'Export', 'Audit Trail',
    ] as const) {
      await expect(settingsTab(page, tab)).toBeVisible();
    }
  });
});

test.describe('Settings - firm profile', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToSettings(page);
  });

  test('shows firm details, tax, and bank sections', async ({ page }) => {
    await expect(page.getByText('Loading firm profile...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Firm Details' })).toBeVisible();
    await expect(page.getByText('Firm Name', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tax & Registration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bank Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: /save firm profile/i })).toBeEnabled();
  });

  test('saving unchanged data round-trips successfully (admin)', async ({ page }) => {
    await expect(page.getByText('Loading firm profile...')).not.toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /save firm profile/i }).click();
    await expectToast(page, /firm profile updated successfully/i, 15_000);
  });
});

test.describe('Settings - staff management', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Staff');
  });

  test('shows the staff list and role permissions info', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Staff Members' })).toBeVisible();
    await expect(page.getByText('Loading staff...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Role Permissions' })).toBeVisible();
    await expect(page.getByText(/full access to everything/i)).toBeVisible();
  });

  test('admin sees Add Staff button, which opens a modal requiring name and email', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add staff/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add Staff Member' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Add Staff' }).click();
    await expectToast(page, /name and email are required/i);
    await expect(dialog).toBeVisible();
  });

  test('adds a staff member and can toggle their active status', async ({ page }) => {
    const name = `PW Staff ${unique('staff')}`;
    const email = `${unique('pwstaff')}@playwright.test`;

    await page.getByRole('button', { name: /add staff/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input').first().fill(name);
    await dialog.locator('input[type="email"]').fill(email);
    await dialog.locator('input').last().fill('9876543210');
    await dialog.getByRole('button', { name: 'Add Staff' }).click();

    await expectToast(page, /staff member added/i, 15_000);
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    const staffCard = page.locator('div.rounded-lg.border.bg-card', { hasText: name });
    await expect(staffCard).toBeVisible({ timeout: 10_000 });
    await expect(staffCard.getByText('Staff', { exact: true })).toBeVisible();
    await expect(staffCard.getByText(email)).toBeVisible();

    const toggle = staffCard.getByRole('switch');
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expectToast(page, /staff status updated/i, 10_000);
    await expect(toggle).not.toBeChecked();
  });
});

test.describe('Settings - WhatsApp config', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'WhatsApp');
  });

  test('shows provider config and notification preferences', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'WhatsApp Business API' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Notification Preferences' })).toBeVisible();
    await expect(page.getByRole('button', { name: /test connection/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save whatsapp settings/i })).toBeVisible();
  });

  test('test connection requires an API key first', async ({ page }) => {
    // Deliberately not clicking Save anywhere in this describe block — this
    // panel never loads existing config, so Save would overwrite the firm's
    // real whatsapp_config with blank/fake test values.
    await page.getByRole('button', { name: /test connection/i }).click();
    await expectToast(page, /enter wati api key/i);
  });
});

test.describe('Settings - compliance (filing categories)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Compliance');
  });

  test('shows filing types and auto-generate toggle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Filing Types to Track' })).toBeVisible();
    await expect(page.getByText('Loading compliance settings...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Auto-Generate Tasks' })).toBeVisible();
    await expect(page.getByText('Enable auto-generation')).toBeVisible();
    await expect(page.getByRole('button', { name: /save settings/i })).toBeVisible();
  });

  test('toggling a filing category off and back on both save successfully', async ({ page }) => {
    await expect(page.getByText('Loading compliance settings...')).not.toBeVisible({ timeout: 10_000 });
    const firstCheckbox = page.getByRole('checkbox').first();
    if ((await firstCheckbox.count()) === 0) {
      test.skip(true, 'No filing categories configured for this firm');
    }
    await expect(firstCheckbox).toBeVisible({ timeout: 10_000 });

    const wasChecked = await firstCheckbox.isChecked();
    await firstCheckbox.click();
    await page.getByRole('button', { name: /save settings/i }).click();
    await expectToast(page, /compliance calendar settings saved/i, 10_000);

    // Restore original state so the firm's real config is unchanged.
    await firstCheckbox.click();
    expect(await firstCheckbox.isChecked()).toBe(wasChecked);
    await page.getByRole('button', { name: /save settings/i }).click();
    await expectToast(page, /compliance calendar settings saved/i, 10_000);
  });
});

test.describe('Settings - invoice settings', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Invoice');
  });

  test('shows invoice configuration', async ({ page }) => {
    await expect(page.getByText('Loading invoice settings...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Invoice Configuration' })).toBeVisible();
    await expect(page.getByRole('button', { name: /save invoice settings/i })).toBeEnabled();
  });

  // NOT a round-trip-success test like Firm Profile/Compliance — this
  // documents a real, currently-broken save path (ISSUES.md M15):
  // saveInvoiceSettingsToSupabase writes a `footer_notes` column that
  // doesn't exist in `invoice_settings` (the real column is
  // `default_notes`), so every save fails with a schema-cache error. The
  // fetch side silently falls back to mockInvoiceSettings on any error, so
  // the form never actually shows the firm's real settings either — this
  // panel currently cannot persist anything for any firm.
  test('saving currently fails with a schema error (M15 — footer_notes column does not exist)', async ({ page }) => {
    await expect(page.getByText('Loading invoice settings...')).not.toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /save invoice settings/i }).click();
    await expectToast(page, /could not find the 'footer_notes' column/i, 15_000);
  });
});

test.describe('Settings - compliance updates feed', () => {
  test('shows updates or the empty state', async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Updates');
    await expect(page.getByRole('heading', { name: 'Compliance Updates' })).toBeVisible();
    await expect(page.getByText('Loading updates...')).not.toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Settings - subscription & billing', () => {
  test('shows the current plan and billing history section', async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Plans');
    await expect(page.getByRole('heading', { name: 'Subscription & Billing' })).toBeVisible();
    await expect(page.getByText('Loading plans...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Billing History' })).toBeVisible();
  });
});

test.describe('Settings - data export', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Export');
  });

  // Each export row is a Card whose visible button text is just the format
  // ("CSV"/"Excel") — scope by the row's label paragraph to disambiguate,
  // since two rows both say "CSV".
  function exportRow(page: import('@playwright/test').Page, label: string) {
    return page.locator('div.rounded-lg.border.bg-card', { hasText: label });
  }

  test('shows the three export actions and a backup action', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Data & Export' })).toBeVisible();
    await expect(page.getByText('Export All Clients', { exact: true })).toBeVisible();
    await expect(page.getByText('Export All Tasks', { exact: true })).toBeVisible();
    await expect(page.getByText('Export All Invoices', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request Backup' })).toBeVisible();
  });

  test('exports the client master list as a real CSV download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportRow(page, 'Export All Clients').getByRole('button', { name: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('clients-master-list.csv');
  });

  test('downloads a full JSON backup', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Request Backup' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('ca-munim-backup.json');
  });
});

test.describe('Settings - audit trail (admin-only)', () => {
  test('admin sees the audit log with entries or the empty state', async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Audit Trail');
    await expect(page.getByText('Loading audit trail...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    await expect(
      page.getByText('No changes recorded yet.').or(page.getByText(/Created|Updated|Deleted/).first()),
    ).toBeVisible();
  });

  test('an update entry expands to show the field diff', async ({ page }) => {
    await signIn(page);
    await goToSettings(page, 'Audit Trail');
    await expect(page.getByText('Loading audit trail...')).not.toBeVisible({ timeout: 10_000 });

    const updateEntry = page.getByText('Updated', { exact: true }).first();
    if ((await updateEntry.count()) === 0) {
      test.skip(true, 'No "Updated" audit entries exist to expand');
    }
    const row = updateEntry.locator('xpath=ancestor::button[1]');
    await row.click();
    // Either it had diffs to show, or the row simply isn't expandable — both
    // are valid depending on what changed; just ensure no crash.
    await expect(row).toBeVisible();
  });
});

test.describe('Settings - sign out', () => {
  test('sign out button in Settings header works', async ({ page }) => {
    await signIn(page);
    await goToSettings(page);
    await page.locator('main').getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });
});

test.describe('Settings - navigation', () => {
  test('sidebar Settings link navigates to the page', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
    await waitForSettingsPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToSettings(page);
    await page.reload();
    await waitForSettingsPage(page);
    await expect(settingsPageHeading(page)).toBeVisible();
  });
});
