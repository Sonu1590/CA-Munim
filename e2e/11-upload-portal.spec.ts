/**
 * e2e/11-upload-portal.spec.ts
 *
 * Tests /upload/:token — the ONLY anonymous, no-login route in the app.
 * Security-sensitive (ISSUES.md C2 was a real cross-tenant data leak here),
 * so this is worth a real end-to-end check, not just a smoke test.
 *
 * Each test that needs a real token creates its own throwaway
 * `document_requests` row via the normal authenticated Documents flow
 * (Request Document modal), reads the token straight off the "Upload Link"
 * preview the modal shows before sending, then visits it in a brand-new,
 * fully unauthenticated browser context (`browser.newContext()`) — never
 * the signed-in `page` — to genuinely exercise the public/anon path rather
 * than an authenticated session that merely looks anonymous.
 *
 * Cleanup: a Playwright test can't reach the DB directly (no service-role
 * key in the test env, by design — see CLAUDE.md's tenancy/RLS notes), so
 * the test clients and document_requests rows created here follow this
 * suite's existing convention (03-clients.spec.ts already leaves created
 * clients behind) rather than attempting cleanup from inside the test.
 * Uploaded storage objects land in a private, non-listable bucket, so
 * leaving a handful of small dummy files from real upload-path runs is a
 * negligible cost against the value of testing that path for real.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { signIn, expectToast } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import { goToDocuments, openDocumentRequestModal, documentRequestDialog } from './helpers/documents';
import { dateOffset } from './helpers/utils';
import { readUploadTokenFromPreview, waitForUploadPortal } from './helpers/uploadPortal';

function makeTestFile(name: string, content = 'dummy file content for e2e upload test') {
  const filePath = path.join(os.tmpdir(), name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

test.describe('Upload Portal - invalid tokens', () => {
  test('a malformed/unknown token shows Invalid Link, not a login redirect', async ({ page }) => {
    await page.goto('/upload/0000000000000000000000000000000000000000000000000000000000000000');
    await expect(page).not.toHaveURL(/\/login$/);
    await waitForUploadPortal(page);
    await expect(page.getByRole('heading', { name: 'Invalid Link' })).toBeVisible();
    await expect(page.getByText(/invalid or has already been used/i)).toBeVisible();
  });

  test('a missing token also shows an error, not a crash', async ({ page }) => {
    await page.goto('/upload/');
    // React Router redirects a param-less /upload/ to NotFound or similar —
    // just assert it never routes to the authenticated app or login.
    await expect(page).not.toHaveURL(/\/login$/);
  });
});

test.describe('Upload Portal - real request, anonymous access', () => {
  test('shows the firm-branded portal with the correct document request details', async ({ page, browser }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToDocuments(page);
    await openDocumentRequestModal(page);
    await documentRequestDialog(page).getByText('Select client', { exact: true }).click();
    await page.getByRole('option', { name: client.name, exact: true }).click();
    await documentRequestDialog(page).getByText('Select document type', { exact: true }).click();
    await page.getByRole('option', { name: 'Bank Statement', exact: true }).click();
    await documentRequestDialog(page).locator('#documentDueDate').fill(dateOffset(10));

    const token = await readUploadTokenFromPreview(page);
    await documentRequestDialog(page).getByRole('button', { name: 'Send Request' }).click();
    await expectToast(page, /document request created/i, 15_000);

    // Genuinely anonymous — a fresh context shares none of `page`'s cookies.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(`/upload/${token}`);
      await expect(anonPage).not.toHaveURL(/\/login$/);
      await waitForUploadPortal(anonPage);

      await expect(anonPage.getByText('Document requested', { exact: true })).toBeVisible();
      await expect(anonPage.getByRole('heading', { name: 'Bank Statement' })).toBeVisible();
      await expect(anonPage.getByText(`For: ${client.name}`)).toBeVisible();
      await expect(anonPage.getByText(/due by/i)).toBeVisible();
      await expect(anonPage.getByText('Drop files here or tap to upload')).toBeVisible();
      // No CA Munim branding, no sidebar, no nav — this is the white-label portal.
      await expect(anonPage.locator('aside')).not.toBeVisible();
    } finally {
      await anonContext.close();
    }
  });

  test('uploads a file and submits successfully', async ({ page, browser }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToDocuments(page);
    await openDocumentRequestModal(page);
    await documentRequestDialog(page).getByText('Select client', { exact: true }).click();
    await page.getByRole('option', { name: client.name, exact: true }).click();
    await documentRequestDialog(page).getByText('Select document type', { exact: true }).click();
    await page.getByRole('option', { name: 'PAN Card Copy', exact: true }).click();
    await documentRequestDialog(page).locator('#documentDueDate').fill(dateOffset(10));

    const token = await readUploadTokenFromPreview(page);
    await documentRequestDialog(page).getByRole('button', { name: 'Send Request' }).click();
    await expectToast(page, /document request created/i, 15_000);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(`/upload/${token}`);
      await waitForUploadPortal(anonPage);

      const filePath = makeTestFile(`ca-munim-e2e-${Date.now()}.pdf`);
      await anonPage.locator('input[type="file"]').setInputFiles(filePath);

      // Uploads to Supabase Storage — wait for it to actually finish.
      await expect(anonPage.getByText(/^100 KB$|KB$/).first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
      const submitBtn = anonPage.getByRole('button', { name: /submit to/i });
      await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
      await submitBtn.click();

      await expect(
        anonPage.getByRole('heading', { name: 'Document uploaded successfully' }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(anonPage.getByText(/has been notified/i)).toBeVisible();
      await expect(anonPage.getByText('Reference:')).toBeVisible();

      fs.unlinkSync(filePath);
    } finally {
      await anonContext.close();
    }
  });

  test('rejects a disallowed file type', async ({ page, browser }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToDocuments(page);
    await openDocumentRequestModal(page);
    await documentRequestDialog(page).getByText('Select client', { exact: true }).click();
    await page.getByRole('option', { name: client.name, exact: true }).click();
    await documentRequestDialog(page).getByText('Select document type', { exact: true }).click();
    await page.getByRole('option', { name: 'Aadhaar Card Copy', exact: true }).click();
    await documentRequestDialog(page).locator('#documentDueDate').fill(dateOffset(10));

    const token = await readUploadTokenFromPreview(page);
    await documentRequestDialog(page).getByRole('button', { name: 'Send Request' }).click();
    await expectToast(page, /document request created/i, 15_000);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(`/upload/${token}`);
      await waitForUploadPortal(anonPage);

      const filePath = makeTestFile(`ca-munim-e2e-${Date.now()}.txt`, 'not an accepted type');
      await anonPage.locator('input[type="file"]').setInputFiles(filePath);
      await expectToast(anonPage, /only pdf, jpg, png allowed/i);

      fs.unlinkSync(filePath);
    } finally {
      await anonContext.close();
    }
  });
});

test.describe('Upload Portal - mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders correctly on a small screen for an invalid token', async ({ page }) => {
    await page.goto('/upload/nonexistent-mobile-check-token');
    await waitForUploadPortal(page);
    await expect(page.getByRole('heading', { name: 'Invalid Link' })).toBeVisible();
  });
});
