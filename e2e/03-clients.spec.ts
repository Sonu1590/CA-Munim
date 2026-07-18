/**
 * e2e/03-clients.spec.ts
 *
 * Tests Clients module:
 * - Page layout and loading
 * - Add client modal (validation + happy path)
 * - Search and type filter
 * - Edit client
 * - Client profile view
 * - Mobile card layout
 * - Error resilience
 */

import { test, expect } from './helpers/coverage';
import { signIn, expectToast } from './helpers/auth';
import {
  goToClients,
  waitForClientsPage,
  clientsPageHeading,
  clientsSearchInput,
  clientsTypeFilter,
  clientDialog,
  openAddClientModal,
  fillAddClientForm,
  saveClientDialog,
  createClient,
  searchClients,
  filterClientsByType,
  buildTestClient,
  pickDateInDialog,
  openEditForClient,
  viewClientProfile,
} from './helpers/clients';

test.describe('Clients — access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    await expect(page).toHaveURL('/clients');
    await expect(clientsPageHeading(page)).toBeVisible();
  });
});

test.describe('Clients — page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
  });

  test('shows header, search, filter, and add button', async ({ page }) => {
    await expect(clientsPageHeading(page)).toBeVisible();
    await expect(clientsSearchInput(page)).toBeVisible();
    await expect(clientsTypeFilter(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /^add client$/i })).toBeVisible();
  });

  test('shows client count badge', async ({ page }) => {
    const badge = clientsPageHeading(page).locator('..').locator('[class*="badge"], .rounded-full').first();
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(text?.trim()).toMatch(/^\d+$/);
  });

  test('shows table with expected columns on desktop', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1280) < 768) {
      test.skip(true, 'Desktop viewport required for table');
    }

    const hasClients = await page.locator('table tbody tr').count() > 0;
    if (!hasClients) {
      await expect(page.getByText('No clients added yet')).toBeVisible();
      return;
    }

    await expect(page.getByRole('columnheader', { name: 'Client Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'PAN' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Active Tasks' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Pending Fees' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Last Activity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });

  test('does not show loading spinner after data loads', async ({ page }) => {
    await expect(page.getByText('Loading clients...')).not.toBeVisible();
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
  });

  test('empty state or client list is shown', async ({ page }) => {
    const hasTableRows = (await page.locator('table tbody tr').count()) > 0;
    const hasEmptyState = await page.getByText('No clients added yet').isVisible().catch(() => false);
    const hasNoMatch = await page.getByText('No clients found matching your search').isVisible().catch(() => false);
    expect(hasTableRows || hasEmptyState || hasNoMatch).toBe(true);
  });
});

test.describe('Clients — add modal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
  });

  test('opens add client modal with required fields', async ({ page }) => {
    await openAddClientModal(page);

    await expect(clientDialog(page).getByLabel('Full Name')).toBeVisible();
    await expect(clientDialog(page).getByText('Select type')).toBeVisible();
    await expect(clientDialog(page).getByLabel('Date of Birth / Incorporation')).toBeVisible();
    await expect(clientDialog(page).getByLabel('PAN Number')).toBeVisible();
    await expect(clientDialog(page).locator('#phone')).toBeVisible();
    await expect(clientDialog(page).getByRole('button', { name: /^save client$/i })).toBeVisible();
    await expect(clientDialog(page).getByRole('button', { name: /^cancel$/i })).toBeVisible();
  });

  test('shows validation error when DOB is missing', async ({ page }) => {
    await openAddClientModal(page);
    const client = buildTestClient();

    await clientDialog(page).getByLabel('Full Name').fill(client.name);
    await clientDialog(page).getByText('Select type').click();
    await page.getByRole('option', { name: 'Individual', exact: true }).click();
    await clientDialog(page).getByLabel('PAN Number').fill(client.pan);
    await clientDialog(page).locator('#phone').fill(client.phone);

    await saveClientDialog(page);

    await expect(
      clientDialog(page).getByText('Date of Birth / Incorporation is required.')
    ).toBeVisible();
    await expect(clientDialog(page)).toBeVisible();
  });

  test('shows PAN entity hint for valid Individual PAN', async ({ page }) => {
    await openAddClientModal(page);

    await clientDialog(page).getByText('Select type').click();
    await page.getByRole('option', { name: 'Individual', exact: true }).click();
    await clientDialog(page).getByLabel('PAN Number').fill('ABCPA1234F');

    await expect(clientDialog(page).getByText(/entity type/i)).toBeVisible();
    await expect(clientDialog(page).getByText('Individual / Person')).toBeVisible();
  });

  test('shows PAN mismatch warning for wrong entity code', async ({ page }) => {
    await openAddClientModal(page);

    await clientDialog(page).getByText('Select type').click();
    await page.getByRole('option', { name: 'Individual', exact: true }).click();
    await clientDialog(page).getByLabel('PAN Number').fill('ABCDE1234F');

    await expect(
      clientDialog(page).getByText(/For Individual, PAN 4th character should be 'P'/i)
    ).toBeVisible();
  });

  test('cancel closes modal when form is empty', async ({ page }) => {
    await openAddClientModal(page);
    await clientDialog(page).getByRole('button', { name: /^cancel$/i }).click();
    await expect(clientDialog(page)).not.toBeVisible();
  });

  test('creates a new client successfully', async ({ page }) => {
    const client = await createClient(page);

    await searchClients(page, client.name);
    await expect(page.locator('table tbody tr', { hasText: client.name })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table tbody tr', { hasText: client.pan })).toBeVisible();
  });
});

test.describe('Clients — search and filter', () => {
  let seededClient: ReturnType<typeof buildTestClient>;

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    seededClient = await createClient(page, { type: 'Individual' });
  });

  test('filters clients by name', async ({ page }) => {
    await searchClients(page, seededClient.name);
    await expect(page.locator('table tbody tr', { hasText: seededClient.name })).toBeVisible();
    await expect(page.getByText('No clients found matching your search')).not.toBeVisible();
  });

  test('filters clients by PAN', async ({ page }) => {
    await searchClients(page, seededClient.pan);
    await expect(page.locator('table tbody tr', { hasText: seededClient.pan })).toBeVisible();
  });

  test('filters clients by phone', async ({ page }) => {
    await searchClients(page, seededClient.phone);
    await expect(page.locator('table tbody tr', { hasText: seededClient.phone })).toBeVisible();
  });

  test('shows no results message for nonsense query', async ({ page }) => {
    await searchClients(page, 'xyz_nonexistent_client_query_99999');
    await expect(page.getByText('No clients found matching your search')).toBeVisible();
  });

  test('type filter narrows results', async ({ page }) => {
    await filterClientsByType(page, 'Individual');
    await expect(page.locator('table tbody tr', { hasText: seededClient.name })).toBeVisible();

    await filterClientsByType(page, 'Private Ltd');
    const visible = await page.locator('table tbody tr', { hasText: seededClient.name }).isVisible().catch(() => false);
    if (visible) {
      await expect(page.locator('table tbody tr', { hasText: 'Private Ltd' }).first()).toBeVisible();
    } else {
      await expect(
        page.getByText('No clients found matching your search').or(page.getByText('No clients added yet'))
      ).toBeVisible();
    }
  });

  test('clearing search restores broader results', async ({ page }) => {
    await searchClients(page, 'xyz_nonexistent_client_query_99999');
    await expect(page.getByText('No clients found matching your search')).toBeVisible();

    await searchClients(page, '');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Clients — edit', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
  });

  test('opens edit modal with existing client data', async ({ page }) => {
    const client = await createClient(page);
    await searchClients(page, client.name);
    await openEditForClient(page, client.name);

    await expect(clientDialog(page).getByLabel('Full Name')).toHaveValue(client.name);
    await expect(clientDialog(page).getByLabel('PAN Number')).toHaveValue(client.pan);
    await expect(clientDialog(page).locator('#phone')).toHaveValue(client.phone);
  });

  test('updates client name', async ({ page }) => {
    const client = await createClient(page);
    const updatedName = `${client.name} Updated`;

    await searchClients(page, client.name);
    await openEditForClient(page, client.name);
    await clientDialog(page).getByLabel('Full Name').fill(updatedName);
    await clientDialog(page).getByRole('button', { name: /^update client$/i }).click();

    await expectToast(page, /client updated/i, 15_000);
    await searchClients(page, updatedName);
    await expect(page.locator('table tbody tr', { hasText: updatedName })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Clients — profile', () => {
  test('view opens client profile with tabs', async ({ page }) => {
    await signIn(page);
    await goToClients(page);

    const client = await createClient(page);
    await searchClients(page, client.name);
    await viewClientProfile(page, client.name);

    await expect(page.getByRole('heading', { name: client.name })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tasks' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Documents' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Billing' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Activity' })).toBeVisible();
    await expect(page.getByText(client.pan)).toBeVisible();
  });

  test('back link returns to clients list', async ({ page }) => {
    await signIn(page);
    await goToClients(page);

    const client = await createClient(page);
    await searchClients(page, client.name);
    await viewClientProfile(page, client.name);

    await page.getByRole('button', { name: /clients/i }).click();
    await expect(page).toHaveURL('/clients');
    await expect(clientsPageHeading(page)).toBeVisible();
  });

  test('profile tabs switch content', async ({ page }) => {
    await signIn(page);
    await goToClients(page);

    const client = await createClient(page);
    await searchClients(page, client.name);
    await viewClientProfile(page, client.name);

    await page.getByRole('tab', { name: 'Tasks' }).click();
    await expect(page.getByText(/no tasks for this client yet/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Billing' }).click();
    await expect(page.getByText(/no invoices for this client yet/i)).toBeVisible();
  });

  test('invalid client id shows not found', async ({ page }) => {
    await signIn(page);
    await page.goto('/clients/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('Client not found.')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page).toHaveURL('/clients');
  });
});

test.describe('Clients — mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
  });

  test('shows mobile client cards instead of table', async ({ page }) => {
    const client = await createClient(page);
    await searchClients(page, client.name);

    await expect(page.locator('table')).not.toBeVisible();
    await expect(page.locator('.md\\:hidden').getByText(client.name).first()).toBeVisible();
  });

  test('mobile card edit opens modal', async ({ page }) => {
    const client = await createClient(page);
    await searchClients(page, client.name);

    const card = page.locator('.md\\:hidden').filter({ hasText: client.name }).first();
    await card.getByRole('button').nth(1).click();

    await expect(clientDialog(page).getByRole('heading', { name: 'Edit Client' })).toBeVisible();
  });
});

test.describe('Clients — navigation', () => {
  test('sidebar Clients link navigates to clients page', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page).toHaveURL('/clients');
    await waitForClientsPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    await page.reload();
    await waitForClientsPage(page);
    await expect(clientsPageHeading(page)).toBeVisible();
  });
});
