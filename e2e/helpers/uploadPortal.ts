/**
 * e2e/helpers/uploadPortal.ts
 * Helpers for the public, anonymous /upload/:token route
 */
import { Page, expect } from '@playwright/test';
import { documentRequestDialog, fillDocumentRequest } from './documents';

/**
 * Creates a real document request via the authenticated app flow (Documents
 * > Request Document) and returns its upload token — read straight from the
 * "Upload Link" preview the modal shows before sending, since that's the
 * only place the raw token is ever exposed client-side. Does NOT click
 * "Send Request" — the caller decides whether to actually persist it.
 */
export async function readUploadTokenFromPreview(page: Page): Promise<string> {
  const dialog = documentRequestDialog(page);
  const linkText = await dialog.locator('span.font-mono').innerText();
  const match = linkText.match(/\/upload\/([0-9a-f]+)/i);
  if (!match) throw new Error(`Could not find an upload token in preview text: "${linkText}"`);
  return match[1];
}

export function uploadPortalHeading(page: Page) {
  // "Document requested" is a label <p>, not a heading — the actual <h2> is
  // the dynamic document name, which varies per request.
  return page.getByText('Document requested', { exact: true }).or(
    page.getByRole('heading', { name: 'Invalid Link' }),
  );
}

export async function waitForUploadPortal(page: Page) {
  await expect(page.getByText('Loading upload details...')).not.toBeVisible({ timeout: 15_000 });
}
