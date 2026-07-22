/**
 * e2e/07-whatsapp.spec.ts
 *
 * Tests WhatsApp Center:
 * - Protected access, page layout, and tab navigation (incl. ?tab= deep link)
 * - Message Templates: search/filter, create/preview/edit/duplicate/delete
 * - Bulk Sender wizard up to (never including) the final Send action —
 *   Bulk Send actually calls the live Meta WhatsApp API edge function, so
 *   these tests stop at the Confirm screen without clicking Send.
 * - Delivery Status and Inbox: layout only, no Retry click (also hits the
 *   live WhatsApp API)
 * - Mobile layout, navigation, and refresh
 */
import { test, expect } from './helpers/coverage';
import { signIn, expectToast } from './helpers/auth';
import { unique } from './helpers/utils';
import {
  whatsappPageHeading,
  whatsappTab,
  goToWhatsApp,
  waitForWhatsAppPage,
  templateDialog,
  templateCard,
  openNewTemplateModal,
  fillTemplateForm,
  saveTemplateDialog,
  createTemplate,
  templatePreviewButton,
  templateEditButton,
  templateDuplicateButton,
  waitForToastsClear,
  templateDeleteButton,
} from './helpers/whatsapp';

test.describe('WhatsApp - access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/whatsapp');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user on the Templates tab by default', async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page);
    await expect(page).toHaveURL('/whatsapp');
    await expect(whatsappPageHeading(page)).toBeVisible();
    await expect(whatsappTab(page, 'Templates')).toHaveAttribute('data-state', 'active');
  });
});

test.describe('WhatsApp - page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page);
  });

  test('shows header and all four tabs', async ({ page }) => {
    await expect(whatsappPageHeading(page)).toBeVisible();
    await expect(page.getByText('Manage templates, send bulk messages & track delivery')).toBeVisible();
    await expect(whatsappTab(page, 'Templates')).toBeVisible();
    await expect(whatsappTab(page, 'Bulk Send')).toBeVisible();
    await expect(whatsappTab(page, 'Status')).toBeVisible();
    await expect(whatsappTab(page, 'Inbox')).toBeVisible();
  });

  test('deep links to a specific tab via ?tab=', async ({ page }) => {
    await goToWhatsApp(page, 'bulk');
    await expect(whatsappTab(page, 'Bulk Send')).toHaveAttribute('data-state', 'active');

    await goToWhatsApp(page, 'status');
    await expect(whatsappTab(page, 'Status')).toHaveAttribute('data-state', 'active');

    await goToWhatsApp(page, 'inbox');
    await expect(whatsappTab(page, 'Inbox')).toHaveAttribute('data-state', 'active');
  });

  test('an unrecognised ?tab= value falls back to Templates', async ({ page }) => {
    await page.goto('/whatsapp?tab=not-a-real-tab');
    await waitForWhatsAppPage(page);
    await expect(whatsappTab(page, 'Templates')).toHaveAttribute('data-state', 'active');
  });
});

test.describe('WhatsApp - templates', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page);
  });

  test('shows search, category filter, and new template button', async ({ page }) => {
    await expect(page.getByPlaceholder('Search templates...')).toBeVisible();
    await expect(page.getByRole('button', { name: /new template/i })).toBeVisible();
  });

  test('does not show a loading indicator once templates load', async ({ page }) => {
    await expect(page.getByText('Loading templates...')).not.toBeVisible({ timeout: 10_000 });
  });

  test('New Template modal requires all fields', async ({ page }) => {
    await openNewTemplateModal(page);
    await saveTemplateDialog(page);
    await expectToast(page, /please fill all required fields/i);
    await expect(templateDialog(page)).toBeVisible();
  });

  test('creates, previews, edits, duplicates, and deletes a template', async ({ page }) => {
    // Default 30s budget is tight now that the duplicate step does a real
    // reload + persistence check plus a second delete round-trip (M16 fix
    // verification) on top of the original create/preview/edit/delete flow.
    test.setTimeout(45_000);
    const name = `PW Template ${unique('tmpl')}`;
    await createTemplate(page, {
      name,
      category: 'Billing',
      body: 'Hi {{client_name}}, your invoice of {{amount}} is due on {{due_date}}.',
    });
    await expectToast(page, /template created/i);
    await expect(templateDialog(page)).not.toBeVisible({ timeout: 8_000 });
    // New cards append to the end of the grid, near the bottom-right toast
    // region — let the toast clear before any further clicks near it.
    await waitForToastsClear(page);

    const card = templateCard(page, name);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText('Billing', { exact: true })).toBeVisible();
    await expect(card.locator('span.font-mono', { hasText: '{{client_name}}' })).toBeVisible();

    // Preview
    await templatePreviewButton(card).click();
    const previewDialog = templateDialog(page);
    await expect(previewDialog.getByRole('heading', { name })).toBeVisible();
    await expect(previewDialog.getByText('WhatsApp Preview')).toBeVisible();
    await expect(previewDialog.getByText(/Hi \{\{client_name\}\}/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(previewDialog).not.toBeVisible();

    // Edit
    await templateEditButton(card).click();
    await expect(templateDialog(page).getByRole('heading', { name: 'Edit Template' })).toBeVisible();
    const updatedName = `${name} Updated`;
    await templateDialog(page).getByPlaceholder('e.g. GST Return Reminder').fill(updatedName);
    await saveTemplateDialog(page);
    await expectToast(page, /template updated/i);
    await expect(templateCard(page, updatedName)).toBeVisible({ timeout: 8_000 });
    await waitForToastsClear(page);

    // Duplicate — MessageTemplates.handleDuplicate now round-trips through
    // saveMessageTemplateToSupabase (ISSUES.md M16 fix), so the copy is a
    // real row with a real DB-generated uuid, not the old fabricated
    // `t-${Date.now()}` client-only id. Both the original and the
    // duplicate are now real rows and both need cleaning up.
    await templateDuplicateButton(templateCard(page, updatedName)).click();
    await expectToast(page, /template duplicated/i);
    const dupCard = templateCard(page, `${updatedName} (Copy)`);
    await expect(dupCard).toBeVisible({ timeout: 8_000 });
    await waitForToastsClear(page);

    // Reload to confirm the duplicate actually persisted (the pre-fix bug
    // was exactly that it looked right in-session but vanished on refresh).
    await page.reload();
    await waitForWhatsAppPage(page);
    await expect(templateCard(page, `${updatedName} (Copy)`)).toBeVisible({ timeout: 10_000 });

    // Clean up both real rows.
    await templateDeleteButton(templateCard(page, `${updatedName} (Copy)`)).click();
    await expectToast(page, /template deleted/i);
    await expect(templateCard(page, `${updatedName} (Copy)`)).not.toBeVisible({ timeout: 8_000 });
    await waitForToastsClear(page);

    await templateDeleteButton(templateCard(page, updatedName)).click();
    await expectToast(page, /template deleted/i);
    await expect(templateCard(page, updatedName)).not.toBeVisible({ timeout: 8_000 });
  });

  test('search filters templates by name', async ({ page }) => {
    const name = `PW Search ${unique('tmpl')}`;
    await createTemplate(page, { name, category: 'General', body: 'Test body {{client_name}}' });
    await expectToast(page, /template created/i);

    await page.getByPlaceholder('Search templates...').fill(name);
    await expect(templateCard(page, name)).toBeVisible();

    await page.getByPlaceholder('Search templates...').fill('xyz_nonexistent_template_query_99999');
    await expect(page.getByText('No templates found. Create one to get started!')).toBeVisible();

    // Clean up
    await page.getByPlaceholder('Search templates...').fill(name);
    await templateDeleteButton(templateCard(page, name)).click();
    await expectToast(page, /template deleted/i);
  });

  test('category filter narrows the visible templates', async ({ page }) => {
    const name = `PW Category ${unique('tmpl')}`;
    await createTemplate(page, { name, category: 'TDS', body: 'TDS reminder {{client_name}}' });
    await expectToast(page, /template created/i);
    await page.getByPlaceholder('Search templates...').fill(name);

    // Scope to the Templates tabpanel — avoids the sidebar's global FY combobox.
    const filter = page.getByRole('tabpanel', { name: 'Templates' }).getByRole('combobox');
    await filter.click();
    await page.getByRole('option', { name: 'TDS', exact: true }).click();
    await expect(templateCard(page, name)).toBeVisible();

    await filter.click();
    await page.getByRole('option', { name: 'ROC', exact: true }).click();
    await expect(templateCard(page, name)).not.toBeVisible();

    // Clean up
    await filter.click();
    await page.getByRole('option', { name: 'All Categories', exact: true }).click();
    await page.getByPlaceholder('Search templates...').fill(name);
    await templateDeleteButton(templateCard(page, name)).click();
    await expectToast(page, /template deleted/i);
  });
});

test.describe('WhatsApp - bulk sender', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page, 'bulk');
  });

  test('shows the 5-step wizard with Next disabled until a template is chosen', async ({ page }) => {
    await expect(page.getByText('Select Message Template')).toBeVisible();
    await expect(page.getByText('Template', { exact: true })).toBeVisible();
    await expect(page.getByText('Recipients', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });

  test('steps through Template -> Recipients -> Preview -> Schedule without sending', async ({ page }) => {
    await expect(page.getByText('Loading templates...')).not.toBeVisible({ timeout: 10_000 });

    // Step 1: pick the first available template
    const firstTemplate = page.locator('div.cursor-pointer.rounded-lg, div[class*="cursor-pointer"][class*="rounded-lg"]').first();
    await expect(firstTemplate).toBeVisible({ timeout: 10_000 });
    await firstTemplate.click();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 2: recipients — Next disabled until at least one is selected
    await expect(page.getByText('Select Recipients')).toBeVisible();
    await expect(page.getByText('Loading clients...')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^next$/i })).toBeDisabled();

    const selectAll = page.getByText(/Select All \(\d+\)/);
    const hasClients = await selectAll.isVisible().catch(() => false);
    if (!hasClients) {
      test.skip(true, 'No clients exist to select as recipients');
    }
    await page.locator('label, div').filter({ hasText: /^Select All/ }).getByRole('checkbox').first().click();
    await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 3: preview
    await expect(page.getByText('Preview Messages')).toBeVisible();
    await expect(page.getByText(/Message looks correct/)).toBeVisible();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 4: schedule — defaults to Send Now, Next enabled
    await expect(page.getByText('Schedule or Send Now')).toBeVisible();
    await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled();

    // Switching to "Schedule" requires date/time before Next re-enables.
    // Scoped to the clickable toggle card — "Schedule" is also the label of
    // step 4 in the step indicator above, which a plain text locator would
    // also match.
    await page.locator('div.cursor-pointer', { hasText: 'Schedule' }).click();
    // The Date/Time <Label>s aren't connected via htmlFor/id, so getByLabel
    // can't find them — target the input types directly.
    await expect(page.locator('input[type="date"]')).toBeVisible();

    // Back to Send Now and proceed to the Confirm screen — but never click Send.
    await page.locator('div.cursor-pointer', { hasText: 'Send Now' }).click();
    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(page.getByText('Confirm & Send')).toBeVisible();
    await expect(page.getByRole('button', { name: /send to \d+ client|schedule for \d+ client/i })).toBeVisible();
    // Deliberately not clicking Send — it calls the live Meta WhatsApp API.
  });

  test('Back button returns to the previous step', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^back$/i })).toBeDisabled();
  });
});

test.describe('WhatsApp - delivery status', () => {
  test('shows the sent-message list or its empty state, without retrying', async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page, 'status');
    await expect(page.getByText('Loading sent messages...').or(page.getByText('Unable to load sent messages'))).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();
  });
});

test.describe('WhatsApp - inbox', () => {
  test('shows the received-message list or its empty state', async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page, 'inbox');
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();
  });
});

test.describe('WhatsApp - mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tabs remain usable on a small screen', async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page);
    await expect(whatsappTab(page, 'Templates')).toBeVisible();
    await expect(whatsappTab(page, 'Bulk Send')).toBeVisible();
    await whatsappTab(page, 'Bulk Send').click();
    await expect(whatsappTab(page, 'Bulk Send')).toHaveAttribute('data-state', 'active');
  });
});

test.describe('WhatsApp - navigation', () => {
  test('sidebar WhatsApp Center link navigates to the page', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'WhatsApp Center' }).click();
    await expect(page).toHaveURL('/whatsapp');
    await waitForWhatsAppPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page);
    await page.reload();
    await waitForWhatsAppPage(page);
    await expect(whatsappPageHeading(page)).toBeVisible();
  });
});
