/**
 * e2e/helpers/whatsapp.ts
 * Navigation and interaction helpers for the WhatsApp Center
 */
import { Page, Locator, expect } from '@playwright/test';
import { waitForLoading } from './auth';

export function whatsappPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'WhatsApp Center', exact: true });
}

export function whatsappTab(page: Page, name: 'Templates' | 'Bulk Send' | 'Status' | 'Inbox') {
  return page.getByRole('tab', { name });
}

export async function goToWhatsApp(page: Page, tab?: 'templates' | 'bulk' | 'status' | 'inbox') {
  await page.goto(tab ? `/whatsapp?tab=${tab}` : '/whatsapp');
  await waitForWhatsAppPage(page);
}

export async function waitForWhatsAppPage(page: Page) {
  await expect(whatsappPageHeading(page)).toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}

export function templateDialog(page: Page) {
  return page.getByRole('dialog');
}

/** Card wrapper for a template — scoped by its distinctive `hover:shadow-md`
 * class and its CardTitle's *exact* name, since a plain substring match
 * (e.g. hasText) would also match a "Foo" card against a "Foo (Copy)" one. */
export function templateCard(page: Page, name: string) {
  return page.locator('div.hover\\:shadow-md').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

export async function openNewTemplateModal(page: Page) {
  await page.getByRole('button', { name: /new template/i }).click();
  await expect(templateDialog(page)).toBeVisible({ timeout: 5_000 });
  await expect(templateDialog(page).getByRole('heading', { name: 'Create Template' })).toBeVisible();
}

export interface TemplateFormOptions {
  name: string;
  category?: string;
  body: string;
}

export async function fillTemplateForm(page: Page, options: TemplateFormOptions) {
  const dialog = templateDialog(page);
  await dialog.getByPlaceholder('e.g. GST Return Reminder').fill(options.name);
  if (options.category) {
    await dialog.getByText('Select category', { exact: true }).click();
    await page.getByRole('option', { name: options.category, exact: true }).click();
  }
  await dialog.getByPlaceholder(/Use \{\{variable_name\}\}/).fill(options.body);
}

export async function saveTemplateDialog(page: Page) {
  await templateDialog(page).getByRole('button', { name: 'Save Template' }).click();
}

export async function createTemplate(page: Page, options: TemplateFormOptions) {
  await openNewTemplateModal(page);
  await fillTemplateForm(page, options);
  await saveTemplateDialog(page);
}

export function templatePreviewButton(card: Locator) {
  return card.locator('button:has(svg.lucide-eye)');
}
export function templateEditButton(card: Locator) {
  return card.locator('button:has(svg.lucide-square-pen)');
}
export function templateDuplicateButton(card: Locator) {
  return card.locator('button:has(svg.lucide-copy)');
}
export function templateDeleteButton(card: Locator) {
  // Trash2 renders class "lucide-trash2" (no hyphen before the 2) — verified
  // by rendering the icon directly, since it doesn't follow the usual
  // kebab-case-of-every-word pattern the other icons here do.
  return card.locator('button:has(svg.lucide-trash2)');
}

export function bulkSenderStepHeading(page: Page, name: string) {
  return page.getByRole('heading', { name, exact: true });
}

/** Waits for all sonner toasts to fully clear. Necessary before interacting
 * with anything under the bottom-right toast region (e.g. the last template
 * card's action buttons): Sonner pauses its auto-dismiss timer while the
 * mouse hovers a toast, and Playwright's click-retry loop does exactly that
 * when the target sits behind one — without this, the toast can block the
 * click indefinitely instead of the usual ~4s.
 *
 * The mouse-move matters, not just the wait: :hover is positional, not
 * event-driven, so if a *previous* click landed the cursor on/near the
 * toast's fixed bottom-right position (common on narrow/mobile viewports
 * where a card's action buttons sit close to it), the browser keeps
 * reporting a hover with no further mouse movement — Sonner's dismiss timer
 * then never resumes and the toast sits there until the *test's* timeout,
 * not its own ~4s duration. Moving the cursor to a neutral corner first
 * forces a real mouseleave so the toast can actually expire. Confirmed live:
 * without this, `creates, previews, edits, duplicates, and deletes a
 * template` in 07-whatsapp.spec.ts intermittently fails on chromium/
 * mobile-ios (never mobile-android, whose bottom-nav layout keeps the toast
 * further from the card buttons) with the toast's `<li data-sonner-toast>`
 * reported as intercepting pointer events on the next click. */
export async function waitForToastsClear(page: Page, timeout = 8_000) {
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout }).catch(() => {});
}
