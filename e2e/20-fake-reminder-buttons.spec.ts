/**
 * e2e/20-fake-reminder-buttons.spec.ts
 *
 * Documents a real, currently-unfixed CRITICAL bug — ISSUES.md C6 — rather
 * than asserting ideal behavior. Existing coverage (02-dashboard.spec.ts's
 * button-presence check, 04-documents.spec.ts's and 05-billing.spec.ts's
 * "reminder reports success" tests) all correctly describe current
 * behavior as written, but none of them prove *nothing is actually sent*
 * — this file adds that proof via network-request monitoring, for all
 * three "Send Reminder" buttons in the app:
 *
 * - Dashboard (ComplianceAlerts.tsx): no onClick handler at all — not
 *   even a fake toast, a pure no-op.
 * - Documents Pending Requests (BulkDocumentStatus.tsx): shows a
 *   "Reminder sent to ..." toast, fires zero network requests.
 * - Billing Fees Dashboard (FeesDashboard.tsx): same shape as Documents.
 *
 * None of the three call sendBulkWhatsAppMessages (the real, H5-fixed
 * send function) or any other messaging/logging function. Once C6 is
 * fixed, these assertions should flip to: a real request fires (to
 * sendBulkWhatsAppMessages's underlying edge function or equivalent), and
 * the Dashboard button gets a real handler + feedback.
 */
import { test, expect } from './helpers/coverage';
import { signIn } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import { goToDocuments, openDocumentRequestModal, fillDocumentRequest } from './helpers/documents';
import { goToBilling } from './helpers/billing';
import { dateOffset } from './helpers/utils';

/** Tracks REST/edge-function requests fired after a given point, to prove
 * (or disprove) that a click actually reached the backend. */
function trackApiRequests(page: import('@playwright/test').Page) {
  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/rest/v1/') || req.url().includes('/functions/v1/')) {
      requests.push(`${req.method()} ${req.url()}`);
    }
  });
  return requests;
}

test.describe('Fake reminder buttons (C6)', () => {
  test('Dashboard "Send Reminder" has no handler — no toast, no request, nothing happens', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });

    const btn = page.getByRole('button', { name: /send reminder/i }).first();
    if ((await btn.count()) === 0) {
      test.skip(true, 'No compliance alerts with a Send Reminder button exist today');
    }

    const requests = trackApiRequests(page);
    const toastCountBefore = await page.locator('[data-sonner-toast]').count();
    await btn.click();
    await page.waitForTimeout(1_500);

    expect(await page.locator('[data-sonner-toast]').count()).toBe(toastCountBefore);
    expect(requests).toEqual([]);
  });

  test('Documents "Remind" shows a success toast but fires zero requests', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);
    await goToDocuments(page);
    await openDocumentRequestModal(page);
    await fillDocumentRequest(page, { clientName: client.name, documentType: 'Bank Statement', dueDate: dateOffset(7) });
    await page.getByRole('dialog').getByRole('button', { name: 'Send Request' }).click();
    await expect(page.getByText(/document request created/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'Pending Requests' }).click();
    const remindBtn = page.getByRole('button', { name: /remind|send reminder/i }).first();
    await expect(remindBtn).toBeVisible({ timeout: 10_000 });

    const requests = trackApiRequests(page);
    await remindBtn.click();
    await expect(page.getByText(/reminder sent to/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    // The toast is real; the requests list proves nothing backed it.
    expect(requests).toEqual([]);
  });

  test('Billing Fees Dashboard "Send Reminder" shows a success toast but fires zero requests', async ({ page }) => {
    await signIn(page);
    await goToBilling(page);
    await page.getByRole('tab', { name: 'Fees Dashboard' }).click();

    // Same "skip if nothing actionable" pattern as 05-billing.spec.ts's own
    // reminder test — a newly-created invoice is Draft status, which (per
    // the already-documented H3) doesn't appear in this "outstanding" list
    // at all, so this only runs against whatever outstanding invoices
    // already exist in the shared test project.
    const reminderBtn = page.getByRole('button', { name: 'Send Reminder' }).first();
    if ((await reminderBtn.count()) === 0) {
      test.skip(true, 'No outstanding invoice exists to test against');
    }

    const requests = trackApiRequests(page);
    await reminderBtn.click();
    await expect(page.getByText(/reminder sent to/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    expect(requests).toEqual([]);
  });
});
