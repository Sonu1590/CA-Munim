/**
 * e2e/helpers/clients.ts
 * Navigation and form helpers for the Clients module
 */
import { Page, expect } from '@playwright/test';
import { expectToast, waitForLoading } from './auth';
import { fakePAN, fakePhone, unique } from './utils';

export interface TestClientData {
  name: string;
  pan: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  type: string;
}

export function buildTestClient(overrides: Partial<TestClientData> = {}): TestClientData {
  const id = unique('client');
  return {
    name: `PW ${id}`,
    pan: fakePAN(),
    phone: fakePhone(),
    email: `${id}@playwright.test`,
    city: 'Pune',
    state: 'Maharashtra',
    type: 'Individual',
    ...overrides,
  };
}

export function clientsPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'Clients', exact: true });
}

export function clientsSearchInput(page: Page) {
  return page.getByPlaceholder('Search by name, PAN, or phone...');
}

export function clientsTypeFilter(page: Page) {
  // Scope to the clients page content — avoid the sidebar FY combobox
  return clientsPageHeading(page)
    .locator('xpath=ancestor::div[contains(@class,"max-w-6xl")]')
    .getByRole('combobox');
}

export function clientDialog(page: Page) {
  return page.getByRole('dialog');
}

export function clientPhoneInput(page: Page) {
  return clientDialog(page).locator('#phone');
}

/** Navigate to /clients and wait for the list (or empty state) to load. */
export async function goToClients(page: Page) {
  await page.goto('/clients');
  await waitForClientsPage(page);
}

export async function waitForClientsPage(page: Page) {
  await expect(clientsPageHeading(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Loading clients...')).not.toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}

export async function openAddClientModal(page: Page) {
  await page.getByRole('button', { name: /^add client$/i }).click();
  await expect(clientDialog(page)).toBeVisible({ timeout: 5_000 });
  await expect(clientDialog(page).getByRole('heading', { name: 'Add New Client' })).toBeVisible();
}

export async function pickDateInDialog(page: Page, fieldId: string, day = '15') {
  const dialog = clientDialog(page);
  await dialog.locator(`#${fieldId}`).click();
  // react-day-picker v8: day cells are gridcells inside the open dialog/popover
  const dayCell = page.getByRole('gridcell', { name: day, exact: true });
  await expect(dayCell).toBeVisible({ timeout: 5_000 });
  await dayCell.click();
}

export async function fillAddClientForm(
  page: Page,
  data: Partial<TestClientData> & { skipDob?: boolean } = {},
) {
  const client = buildTestClient(data);
  const dialog = clientDialog(page);

  await dialog.getByLabel('Full Name').fill(client.name);

  if (client.type) {
    await dialog.getByText('Select type').click();
    await page.getByRole('option', { name: client.type, exact: true }).click();
  }

  if (!data.skipDob) {
    await pickDateInDialog(page, 'dob');
  }

  await dialog.getByLabel('PAN Number').fill(client.pan);
  await clientPhoneInput(page).fill(client.phone);

  if (client.email) {
    await dialog.getByLabel('Email').fill(client.email);
  }
  if (client.city) {
    await dialog.getByLabel('City').fill(client.city);
  }
  if (client.state) {
    await dialog.getByText('Select state').click();
    await page.getByRole('option', { name: client.state, exact: true }).click();
  }

  return client;
}

export async function saveClientDialog(page: Page) {
  await clientDialog(page).getByRole('button', { name: /^save client$/i }).click();
}

export async function createClient(page: Page, overrides: Partial<TestClientData> = {}) {
  await openAddClientModal(page);
  const client = await fillAddClientForm(page, overrides);
  await saveClientDialog(page);
  await expectToast(page, /client added/i, 15_000);
  await expect(clientDialog(page)).not.toBeVisible({ timeout: 8_000 });
  return client;
}

export async function searchClients(page: Page, query: string) {
  await clientsSearchInput(page).fill(query);
}

export async function filterClientsByType(page: Page, type: string) {
  await clientsTypeFilter(page).click();
  await page.getByRole('option', { name: type, exact: true }).click();
}

export async function openEditForClient(page: Page, clientName: string) {
  const row = page.locator('table tbody tr', { hasText: clientName });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(clientDialog(page)).toBeVisible();
  await expect(clientDialog(page).getByRole('heading', { name: 'Edit Client' })).toBeVisible();
}

export async function viewClientProfile(page: Page, clientName: string) {
  const row = page.locator('table tbody tr', { hasText: clientName });
  await row.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/clients\/.+/, { timeout: 8_000 });
}
