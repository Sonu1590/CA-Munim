/**
 * e2e/18-whatsapp-template-variables.spec.ts
 *
 * WhatsApp template `{{variable}}` compilation edge cases not already
 * covered by 07-whatsapp.spec.ts.
 */
import { test, expect } from './helpers/coverage';
import { signIn, expectToast } from './helpers/auth';
import { unique } from './helpers/utils';
import { goToWhatsApp, templateCard, templateDeleteButton, waitForToastsClear } from './helpers/whatsapp';

test.describe('WhatsApp template variables - unknown/malformed placeholders', () => {
  test('an unrecognised {{variable}} in a custom template body renders literally as "N/A"', async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page);

    const name = `PW Unknown Var Test ${unique('var')}`;
    await page.getByRole('button', { name: /new template/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g. GST Return Reminder').fill(name);
    await dialog.getByText('Select category', { exact: true }).click();
    await page.getByRole('option', { name: 'General', exact: true }).click();
    // {{totally_made_up_field}} is not one of compileTemplateForClient's
    // known keys — the replace() fallback (`replacements[key] ?? "N/A"`)
    // means any unrecognised variable name silently becomes literal "N/A"
    // rather than being left as-is or flagged, in both the template editor
    // preview and any real compiled message.
    await dialog.getByPlaceholder(/Use \{\{variable_name\}\}/).fill('Hi {{client_name}}, re: {{totally_made_up_field}}.');
    await dialog.getByRole('button', { name: 'Save Template' }).click();
    await expect(page.getByText(/template created/i)).toBeVisible({ timeout: 10_000 });

    // Clean up.
    await waitForToastsClear(page);
    const card = templateCard(page, name);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await templateDeleteButton(card).click();
    await expectToast(page, /template deleted/i, 10_000);
  });
});

test.describe('WhatsApp template variables - firm identity placeholders', () => {
  // ISSUES.md H7 (fixed): compileTemplateForClient now takes an optional
  // firm parameter, populated from fetchFirmProfileFromSupabase() by both
  // callers (BulkSender's preview/send, DeliveryStatus's retry) instead of
  // hardcoding "Sharma & Associates"/"CA Rajesh Sharma"/"9876543210".
  test('the bulk-send preview shows the real signed-in firm name, not demo data (H7)', async ({ page }) => {
    await signIn(page);
    await goToWhatsApp(page, 'bulk');
    await expect(page.getByText('Loading templates...')).not.toBeVisible({ timeout: 10_000 });

    // "GST Filing Reminder" ends with "- {{firm_name}}". (Note: this is one
    // of the live DB-seeded templates, not the hardcoded defaultTemplates
    // fallback array in WhatsappApi.ts — the two lists aren't the same;
    // e.g. that array's "Deadline Reminder (General)" isn't seeded in the
    // DB, so it never actually appears here.)
    await page.getByText('GST Filing Reminder', { exact: true }).click();
    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(page.getByText('Loading clients...')).not.toBeVisible({ timeout: 10_000 });
    const selectAll = page.getByText(/Select All \(\d+\)/);
    if (!(await selectAll.isVisible().catch(() => false))) {
      test.skip(true, 'No clients exist to select as recipients');
    }
    await page.locator('div').filter({ hasText: /^Select All/ }).getByRole('checkbox').first().click();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 3: Preview Messages — this is the compiled, real-values text,
    // rendered inside WhatsApp-style green preview bubbles. Scoped to that
    // region specifically — "BE10X User" (the real firm name) legitimately
    // appears elsewhere on the page (the sidebar), so a page-wide "not
    // visible" check would be a false pass/fail either way.
    await expect(page.getByText('Preview Messages')).toBeVisible();
    const previewBubble = page.locator('div.rounded-xl.bg-\\[\\#dcf8c6\\]').first();
    await expect(previewBubble).toBeVisible({ timeout: 10_000 });
    await expect(previewBubble.getByText('BE10X User', { exact: false })).toBeVisible();
    // The hardcoded demo firm name never appears in the compiled message.
    await expect(previewBubble.getByText('Sharma & Associates', { exact: false })).not.toBeVisible();
  });
});
