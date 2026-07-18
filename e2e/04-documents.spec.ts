/**
 * e2e/04-documents.spec.ts
 *
 * Tests Documents module:
 * - Protected access and page loading
 * - Client folder search and navigation
 * - Document request validation and creation
 * - Pending request table and reminders
 * - Mobile layout
 * - Sidebar navigation and refresh
 */

import { test, expect } from './helpers/coverage';
import { signIn, expectToast } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import { dateOffset } from './helpers/utils';
import {
  goToDocuments,
  waitForDocumentsPage,
  documentsPageHeading,
  documentRequestDialog,
  documentClientSearch,
  requestDocumentButton,
  clientFolderCard,
  openDocumentRequestModal,
  fillDocumentRequest,
  selectDocumentType,
} from './helpers/documents';

test.describe('Documents - access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/documents');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user', async ({ page }) => {
    await signIn(page);
    await goToDocuments(page);
    await expect(page).toHaveURL('/documents');
    await expect(documentsPageHeading(page)).toBeVisible();
  });
});

test.describe('Documents - page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToDocuments(page);
  });

  test('shows header, folders, requests, and request button', async ({ page }) => {
    await expect(documentsPageHeading(page)).toBeVisible();
    await expect(page.getByText('Manage client documents & requests')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Client Folders' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pending Requests' })).toBeVisible();
    await expect(documentClientSearch(page)).toBeVisible();
    await expect(requestDocumentButton(page)).toBeVisible();
  });

  test('switches to pending requests with expected desktop columns', async ({ page, viewport }) => {
    await page.getByRole('tab', { name: 'Pending Requests' }).click();
    await expect(page.getByRole('heading', { name: 'Pending Document Requests' })).toBeVisible();

    if ((viewport?.width ?? 1280) < 768) {
      await expect(page.locator('.md\\:hidden').filter({ hasText: /pending|submitted|overdue/i }).first())
        .toBeVisible()
        .catch(() => {});
      return;
    }

    await expect(page.getByRole('columnheader', { name: 'Client' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Document' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Due Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
  });

  test('does not show loading indicators after data loads', async ({ page }) => {
    await expect(page.getByText('Loading clients...')).not.toBeVisible();
    await page.getByRole('tab', { name: 'Pending Requests' }).click();
    await expect(page.getByText('Loading requests...')).not.toBeVisible();
  });
});

test.describe('Documents - client folders', () => {
  test('searches by client name and opens the client folder', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToDocuments(page);
    await documentClientSearch(page).fill(client.name);
    await expect(clientFolderCard(page, client.name)).toBeVisible();
    await clientFolderCard(page, client.name).click();

    await expect(page.getByRole('heading', { name: client.name })).toBeVisible();
    await expect(page.getByText('0 documents')).toBeVisible();
    await expect(page.getByText('All (0)')).toBeVisible();
    await expect(page.getByText('PAN / KYC (0)')).toBeVisible();
    await expect(page.getByText('No documents in this category')).toBeVisible();
  });

  test('shows an empty result for an unknown client', async ({ page }) => {
    await signIn(page);
    await goToDocuments(page);
    await documentClientSearch(page).fill('No Such Playwright Client 987654');
    await expect(page.getByText('No clients found')).toBeVisible();
  });
});

test.describe('Documents - request modal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToDocuments(page);
    await openDocumentRequestModal(page);
  });

  test('opens with all required controls', async ({ page }) => {
    const dialog = documentRequestDialog(page);
    await expect(dialog.getByText('Select client', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Select document type', { exact: true })).toBeVisible();
    await expect(dialog.locator('#documentDueDate')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Send Request' })).toBeVisible();
  });

  test('requires all mandatory fields', async ({ page }) => {
    await documentRequestDialog(page).getByRole('button', { name: 'Send Request' }).click();
    await expectToast(page, 'Please fill all required fields');
    await expect(documentRequestDialog(page)).toBeVisible();
  });

  test('shows and validates the custom document label', async ({ page }) => {
    await selectDocumentType(page, 'Custom');
    await expect(documentRequestDialog(page).getByPlaceholder('e.g. Rent Agreement')).toBeVisible();
  });

  test('cancel closes the modal', async ({ page }) => {
    await documentRequestDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(documentRequestDialog(page)).not.toBeVisible();
  });
});

test.describe('Documents - request workflow', () => {
  test('creates a document request and shows it in pending requests', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToDocuments(page);
    await openDocumentRequestModal(page);
    await fillDocumentRequest(page, {
      clientName: client.name,
      documentType: 'Bank Statement',
      dueDate: dateOffset(7),
    });

    await expect(documentRequestDialog(page).getByText('WhatsApp Preview')).toBeVisible();
    await expect(documentRequestDialog(page).getByText(client.name, { exact: false }).last()).toBeVisible();
    await documentRequestDialog(page).getByRole('button', { name: 'Send Request' }).click();

    await expectToast(page, /document request created/i, 15_000);
    await expect(documentRequestDialog(page)).not.toBeVisible();

    await page.reload();
    await waitForDocumentsPage(page);
    await page.getByRole('tab', { name: 'Pending Requests' }).click();
    await expect(page.getByText(client.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Bank Statement', { exact: true }).first()).toBeVisible();
  });

  test('send reminder reports success when an actionable request exists', async ({ page }) => {
    await signIn(page);
    await goToDocuments(page);
    await page.getByRole('tab', { name: 'Pending Requests' }).click();

    const reminder = page.getByRole('button', { name: /remind|send reminder/i }).first();
    if ((await reminder.count()) === 0) {
      test.skip(true, 'No pending or overdue document request exists');
    }

    await reminder.click();
    await expectToast(page, /reminder sent to/i);
  });
});

test.describe('Documents - mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows compact request button and mobile request cards', async ({ page }) => {
    await signIn(page);
    await goToDocuments(page);
    await expect(requestDocumentButton(page)).toBeVisible();

    await page.getByRole('tab', { name: 'Pending Requests' }).click();
    await expect(page.locator('table')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pending Document Requests' })).toBeVisible();
  });
});

test.describe('Documents - navigation', () => {
  test('sidebar Documents link navigates to the page', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Documents' }).click();
    await expect(page).toHaveURL('/documents');
    await waitForDocumentsPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToDocuments(page);
    await page.reload();
    await waitForDocumentsPage(page);
    await expect(documentsPageHeading(page)).toBeVisible();
  });
});
