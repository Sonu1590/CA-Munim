/**
 * e2e/20-fake-reminder-buttons.spec.ts
 *
 * ISSUES.md C6 (fixed): all three "Send Reminder" buttons now do something
 * real instead of faking success.
 *
 * - Dashboard (ComplianceAlerts.tsx): represents N clients affected by one
 *   filing type, not a single client — silently bulk-sending with no
 *   review step would be its own bad idea, so this one now navigates to
 *   the WhatsApp Bulk Sender (?tab=bulk) instead of sending directly.
 * - Documents Pending Requests (BulkDocumentStatus.tsx) and Billing Fees
 *   Dashboard (FeesDashboard.tsx): both represent one real client, so
 *   both now call sendQuickReminder — a real Meta send via the same
 *   H5-fixed edge function path as the Bulk Sender.
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

test.describe('Reminder buttons actually do something (C6)', () => {
  test('Dashboard "Send Reminder" navigates to the WhatsApp Bulk Sender', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });

    const btn = page.getByRole('button', { name: /send reminder/i }).first();
    if ((await btn.count()) === 0) {
      test.skip(true, 'No compliance alerts with a Send Reminder button exist today');
    }

    await btn.click();
    await expect(page).toHaveURL(/\/whatsapp\?tab=bulk/, { timeout: 10_000 });
  });

  // Both remaining tests use a real (fake-phone) e2e test client, so the
  // Meta send itself is expected to fail — right now it fails even earlier
  // than that, since the 4 production templates registered for H5/H7 are
  // still PENDING Meta review, not yet APPROVED (confirmed live: Meta
  // returns "(#132001) Template name does not exist in the translation"
  // for a template that isn't approved yet, caught and surfaced as a
  // normal error toast — this is expected, not a bug). The assertion that
  // matters is that a real network request fires and some toast appears —
  // not the exact wording, which depends on Meta's live response and
  // shouldn't be hard-coded into a brittle pattern.
  test('Documents "Remind" fires a real network request', async ({ page }) => {
    // Real send now goes through the edge function to Meta's Graph API —
    // slower than the old fake instant toast, and the default 30s test
    // timeout can be tight on a cold edge function + real external call.
    test.setTimeout(45_000);
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
    // Wait for any toast (success or error) rather than matching exact
    // text — a real attempt now always ends in one or the other, unlike
    // the old no-op, and the button re-enabling confirms the async flow
    // actually completed.
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 20_000 });
    await expect(remindBtn).toBeEnabled({ timeout: 10_000 });
    expect(requests.length).toBeGreaterThan(0);
  });

  test('Billing Fees Dashboard "Send Reminder" fires a real network request', async ({ page }) => {
    test.setTimeout(45_000);
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
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 20_000 });
    await expect(reminderBtn).toBeEnabled({ timeout: 10_000 });
    expect(requests.length).toBeGreaterThan(0);
  });
});
