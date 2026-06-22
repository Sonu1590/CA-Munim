/**
 * e2e/helpers/documents.ts
 * Navigation and interaction helpers for the Documents module
 */
import { Page, expect } from '@playwright/test';
import { waitForLoading } from './auth';

export function documentsPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'Documents', exact: true });
}

export function documentRequestDialog(page: Page) {
  return page.getByRole('dialog');
}

export function documentClientSearch(page: Page) {
  return page.getByPlaceholder('Search clients by name or PAN...');
}

export function requestDocumentButton(page: Page) {
  return page
    .getByRole('button', { name: /request document/i })
    .or(page.locator('button').filter({ has: page.locator('svg.lucide-send') }))
    .first();
}

export function clientFolderCard(page: Page, clientName: string) {
  return page.locator('[class*="cursor-pointer"]').filter({
    has: page.getByText(clientName, { exact: true }),
  }).first();
}

export async function goToDocuments(page: Page) {
  await page.goto('/documents');
  await waitForDocumentsPage(page);
}

export async function waitForDocumentsPage(page: Page) {
  await expect(documentsPageHeading(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Loading clients...')).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Loading requests...')).not.toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}

export async function openDocumentRequestModal(page: Page) {
  await requestDocumentButton(page).click();
  await expect(documentRequestDialog(page)).toBeVisible();
  await expect(
    documentRequestDialog(page).getByRole('heading', { name: 'Request Document from Client' }),
  ).toBeVisible();
}

export async function selectDocumentRequestClient(page: Page, clientName: string) {
  const dialog = documentRequestDialog(page);
  await dialog.getByText('Select client', { exact: true }).click();
  await page.getByRole('option', { name: clientName, exact: true }).click();
}

export async function selectDocumentType(page: Page, documentType: string) {
  const dialog = documentRequestDialog(page);
  await dialog.getByText('Select document type', { exact: true }).click();
  await page.getByRole('option', {
    name: documentType === 'Custom' ? /Custom \(type your own\)/ : documentType,
    exact: documentType !== 'Custom',
  }).click();
}

export async function fillDocumentRequest(
  page: Page,
  options: {
    clientName: string;
    documentType?: string;
    dueDate: string;
    customLabel?: string;
  },
) {
  await selectDocumentRequestClient(page, options.clientName);
  await selectDocumentType(page, options.documentType ?? 'Bank Statement');

  if (options.documentType === 'Custom' && options.customLabel !== undefined) {
    await documentRequestDialog(page)
      .getByPlaceholder('e.g. Rent Agreement')
      .fill(options.customLabel);
  }

  await documentRequestDialog(page).locator('#documentDueDate').fill(options.dueDate);
}
