/**
 * e2e/15-client-form-validation.spec.ts
 *
 * Form-validation edge cases in the Add Client modal not already covered
 * by 03-clients.spec.ts (which tests PAN entity-code hints/mismatches but
 * not GSTIN). GSTIN gets the same kind of live-validation UI as PAN — a
 * checkmark/X icon plus a state-code preview — and had zero coverage.
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';
import { goToClients, openAddClientModal, clientDialog } from './helpers/clients';

test.describe('Client form - GSTIN validation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    await openAddClientModal(page);
  });

  test('a valid GSTIN shows a checkmark and the matching state', async ({ page }) => {
    const gstin = clientDialog(page).getByLabel('GSTIN');
    await gstin.fill('27AAAAA0000A1Z5'); // 27 = Maharashtra
    await expect(clientDialog(page).locator('svg.lucide-circle-check')).toBeVisible();
    await expect(clientDialog(page).getByText('State:')).toBeVisible();
    await expect(clientDialog(page).getByText('Maharashtra', { exact: true })).toBeVisible();
    await expect(clientDialog(page).getByText('Invalid GSTIN format')).not.toBeVisible();
  });

  test('a 15-character GSTIN with a malformed body shows an error, not just a mismatch', async ({ page }) => {
    const gstin = clientDialog(page).getByLabel('GSTIN');
    // Valid state code (27) and length (15), but the fixed 'Z' position is
    // wrong ('Y') — still fails GSTIN_REGEX.
    await gstin.fill('27AAAAA0000A1Y5');
    await expect(clientDialog(page).locator('svg.lucide-circle-x')).toBeVisible();
    await expect(clientDialog(page).getByText('Invalid GSTIN format')).toBeVisible();
    // The state preview still shows — it's derived from just the first two
    // characters, independent of whether the rest of the format is valid.
    await expect(clientDialog(page).getByText('Maharashtra', { exact: true })).toBeVisible();
  });

  test('typing just the 2-digit state code previews the state before the rest is valid', async ({ page }) => {
    const gstin = clientDialog(page).getByLabel('GSTIN');
    await gstin.fill('07'); // Delhi
    await expect(clientDialog(page).getByText('Delhi', { exact: true })).toBeVisible();
    // Too short to be judged valid/invalid yet — no icon either way.
    await expect(clientDialog(page).locator('svg.lucide-circle-check')).not.toBeVisible();
  });

  test('an unrecognised state code shows no state preview', async ({ page }) => {
    const gstin = clientDialog(page).getByLabel('GSTIN');
    await gstin.fill('99AAAAA0000A1Z5'); // 99 is not an allotted GST state code
    await expect(clientDialog(page).getByText('State:')).not.toBeVisible();
  });

  test('clearing the field removes all GSTIN feedback', async ({ page }) => {
    const gstin = clientDialog(page).getByLabel('GSTIN');
    await gstin.fill('27AAAAA0000A1Z5');
    await expect(clientDialog(page).getByText('State:')).toBeVisible();

    await gstin.fill('');
    await expect(clientDialog(page).getByText('State:')).not.toBeVisible();
    await expect(clientDialog(page).locator('svg.lucide-circle-check')).not.toBeVisible();
    await expect(clientDialog(page).locator('svg.lucide-circle-x')).not.toBeVisible();
  });
});

test.describe('Client form - native browser validation', () => {
  test('email field rejects a malformed address before submit', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    await openAddClientModal(page);

    const emailInput = clientDialog(page).getByLabel('Email');
    await emailInput.fill('not-an-email');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('phone field caps input at 10 digits', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    await openAddClientModal(page);

    await clientDialog(page).locator('#phone').fill('98765432109999');
    await expect(clientDialog(page).locator('#phone')).toHaveValue(/^\d{10}$/);
  });
});
