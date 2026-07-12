/**
 * e2e/13-client-profile.spec.ts
 *
 * Tests ClientProfile (/clients/:id) sub-flows not already covered by
 * 03-clients.spec.ts's "profile" describe block (which only checks that
 * the tabs exist and switch content):
 * - Overview tab stats
 * - Documents / Activity tab hints
 * - Credentials tab (admin-only — the e2e test account is a verified firm
 *   admin, so this is exercised directly): Portal Credentials and DSC
 *   Register CRUD, including the "Reveal" control that fetches plaintext
 *   on demand (ISSUES.md M10 notes this has no re-auth/rate-limit — a
 *   deliberate, accepted gap, not something to flag again here).
 */
import { test, expect } from '@playwright/test';
import { signIn, expectToast } from './helpers/auth';
import { createClient, goToClients, searchClients, viewClientProfile } from './helpers/clients';
import { dateOffset, unique } from './helpers/utils';
import {
  profileTab,
  openAddPortalCredentialModal,
  fillPortalCredentialForm,
  saveCredentialDialog,
  portalCredentialRow,
  openAddDscModal,
  fillDscRecordForm,
  dscRecordRow,
  revealField,
  hideField,
  credentialsDialog,
} from './helpers/clientProfile';

async function openProfile(page: import('@playwright/test').Page) {
  await signIn(page);
  await goToClients(page);
  const client = await createClient(page);
  await searchClients(page, client.name);
  await viewClientProfile(page, client.name);
  return client;
}

test.describe('Client Profile - overview and read-only tabs', () => {
  test('overview shows profile details and stat cards', async ({ page }) => {
    const client = await openProfile(page);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText(client.city!)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pending Fees' })).toBeVisible();
  });

  test('documents tab shows a hint to use the Documents page', async ({ page }) => {
    await openProfile(page);
    await profileTab(page, 'Documents').click();
    await expect(page.getByText(/open documents to manage uploaded files/i)).toBeVisible();
  });

  test('activity tab shows last-updated info', async ({ page }) => {
    await openProfile(page);
    await profileTab(page, 'Activity').click();
    await expect(page.getByText(/last updated/i)).toBeVisible();
  });
});

test.describe('Client Profile - credentials tab (admin)', () => {
  test('is visible for an admin and starts with empty states', async ({ page }) => {
    await openProfile(page);
    await expect(profileTab(page, 'Credentials')).toBeVisible();
    await profileTab(page, 'Credentials').click();
    await expect(page.getByRole('heading', { name: 'Portal Credentials' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DSC Register' })).toBeVisible();
    await expect(page.getByText('No portal credentials saved yet.')).toBeVisible();
    await expect(page.getByText('No DSC records saved yet.')).toBeVisible();
  });

  test('adds, reveals, edits, and deletes a portal credential', async ({ page }) => {
    await openProfile(page);
    await profileTab(page, 'Credentials').click();

    const portalName = `GST Portal ${unique('cred')}`;
    await openAddPortalCredentialModal(page);
    await fillPortalCredentialForm(page, {
      portalName,
      username: 'testuser@example.com',
      password: 'S3cretP@ss',
      notes: 'Playwright test credential',
    });
    await saveCredentialDialog(page);
    await expectToast(page, /credential added/i, 10_000);

    const row = portalCredentialRow(page, portalName);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText('testuser@example.com')).toBeVisible();
    await expect(row.getByText('••••••••')).toBeVisible();

    // Reveal — fetches the real plaintext password.
    await revealField(row);
    await expect(row.getByText('S3cretP@ss', { exact: true })).toBeVisible({ timeout: 10_000 });
    await hideField(row);
    await expect(row.getByText('••••••••')).toBeVisible();

    // Edit
    await row.locator('button:has(svg.lucide-pencil)').click();
    const updatedName = `${portalName} Updated`;
    await expect(credentialsDialog(page).getByRole('heading', { name: 'Edit Portal Credential' })).toBeVisible();
    await credentialsDialog(page).locator('input').first().fill(updatedName);
    await saveCredentialDialog(page);
    await expectToast(page, /credential updated/i, 10_000);
    await expect(portalCredentialRow(page, updatedName)).toBeVisible({ timeout: 10_000 });

    // Delete
    page.once('dialog', (dialog) => dialog.accept());
    await portalCredentialRow(page, updatedName).locator('button:has(svg.lucide-trash2)').click();
    await expectToast(page, /credential deleted/i, 10_000);
    await expect(portalCredentialRow(page, updatedName)).not.toBeVisible({ timeout: 10_000 });
  });

  test('adds a DSC record with an expiring-soon badge, reveals the PIN, then deletes it', async ({ page }) => {
    await openProfile(page);
    await profileTab(page, 'Credentials').click();

    const holderName = `DSC Holder ${unique('dsc')}`;
    await openAddDscModal(page);
    await fillDscRecordForm(page, {
      holderName,
      serial: 'SN-12345',
      issuer: 'eMudhra',
      tokenType: 'USB Token',
      validFrom: dateOffset(-300),
      validUntil: dateOffset(15), // within 30 days => "Expiring soon"
      pin: '1234',
      notes: 'Playwright DSC test',
    });
    await saveCredentialDialog(page);
    await expectToast(page, /dsc record added/i, 10_000);

    const row = dscRecordRow(page, holderName);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText('Expiring soon')).toBeVisible();
    await expect(row.getByText('eMudhra')).toBeVisible();

    await revealField(row);
    await expect(row.getByText('1234', { exact: true })).toBeVisible({ timeout: 10_000 });
    await hideField(row);

    page.once('dialog', (dialog) => dialog.accept());
    await row.locator('button:has(svg.lucide-trash2)').click();
    await expectToast(page, /dsc record deleted/i, 10_000);
    await expect(dscRecordRow(page, holderName)).not.toBeVisible({ timeout: 10_000 });
  });

  test('portal credential form requires a portal name', async ({ page }) => {
    await openProfile(page);
    await profileTab(page, 'Credentials').click();
    await openAddPortalCredentialModal(page);
    await saveCredentialDialog(page);
    await expectToast(page, /portal name is required/i);
    await expect(credentialsDialog(page)).toBeVisible();
  });

  test('DSC record form requires a holder name', async ({ page }) => {
    await openProfile(page);
    await profileTab(page, 'Credentials').click();
    await openAddDscModal(page);
    await saveCredentialDialog(page);
    await expectToast(page, /holder name is required/i);
    await expect(credentialsDialog(page)).toBeVisible();
  });
});
