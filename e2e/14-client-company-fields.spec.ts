/**
 * e2e/14-client-company-fields.spec.ts
 *
 * Tests the "Company / ROC Details" section of the Add/Edit Client form —
 * only rendered for company-type clients (Private Ltd / LLP / Public Ltd),
 * added by the merged M14 fix (ISSUES.md) for ~13 previously-unbound
 * fields. Focuses on the two fields that drive the H6 event-relative
 * due-date work: AGM Due Month (MGT-7/AOC-4/ADT-1) and Last Share
 * Allotment Date (PAS-3) — confirming they actually round-trip through a
 * save + edit-reopen, the same way ISSUES.md's M14 entry verified live.
 */
import { test, expect } from './helpers/coverage';
import { signIn, expectToast } from './helpers/auth';
import {
  goToClients,
  searchClients,
  openEditForClient,
  clientDialog,
  saveClientDialog,
  pickDateInDialog,
} from './helpers/clients';
import { unique } from './helpers/utils';

/** A syntactically valid company-type PAN (4th char 'C') — buildTestClient's
 * fakePAN() always generates an Individual-type PAN (4th char 'P'), which
 * would show a client-type mismatch warning for a Private Ltd client. */
function fakeCompanyPAN(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rand = (n: number) => Math.floor(Math.random() * n);
  return (
    letters[rand(26)] + letters[rand(26)] + letters[rand(26)] +
    'C' + // C = Company
    letters[rand(26)] +
    String(rand(9) + 1) + rand(10) + rand(10) + rand(10) +
    letters[rand(26)]
  );
}

async function fillRequiredCompanyFields(page: import('@playwright/test').Page, name: string, pan: string) {
  const dialog = clientDialog(page);
  await dialog.getByLabel('Full Name').fill(name);
  await dialog.getByText('Select type').click();
  await page.getByRole('option', { name: 'Private Ltd', exact: true }).click();
  await pickDateInDialog(page, 'dob'); // incorporation date
  await dialog.getByLabel('PAN Number').fill(pan);
  await dialog.locator('#phone').fill('9876543210');
}

test.describe('Client form - Company / ROC Details section', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToClients(page);
  });

  test('only appears for company-type clients, not Individual', async ({ page }) => {
    await page.getByRole('button', { name: /^add client$/i }).click();
    await expect(clientDialog(page).getByText('Company / ROC Details')).not.toBeVisible();

    // Scoped by the "Client Type *" label div — once a type is picked, the
    // trigger stops showing the "Select type" placeholder text, so a
    // second selection can't be found by that placeholder anymore.
    const typeField = clientDialog(page).locator('div').filter({ hasText: 'Client Type *' }).last();

    await typeField.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Individual', exact: true }).click();
    await expect(clientDialog(page).getByText('Company / ROC Details')).not.toBeVisible();

    await typeField.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Private Ltd', exact: true }).click();
    await expect(clientDialog(page).getByText('Company / ROC Details')).toBeVisible();
  });

  test('shows AGM Due Month and Last Share Allotment Date with their due-date hints', async ({ page }) => {
    await page.getByRole('button', { name: /^add client$/i }).click();
    await clientDialog(page).getByText('Select type').click();
    await page.getByRole('option', { name: 'Private Ltd', exact: true }).click();

    await expect(clientDialog(page).getByText('AGM Due Month', { exact: true })).toBeVisible();
    await expect(clientDialog(page).getByText('Drives MGT-7/AOC-4/ADT-1 due dates.')).toBeVisible();
    await expect(clientDialog(page).getByLabel('Last Share Allotment Date')).toBeVisible();
    await expect(clientDialog(page).getByText('Drives PAS-3 due date.')).toBeVisible();
  });

  test('AGM Due Month and Last Share Allotment Date persist across a save and edit-reopen', async ({ page }) => {
    const name = `PW Co ${unique('agm')}`;
    const pan = fakeCompanyPAN();

    await page.getByRole('button', { name: /^add client$/i }).click();
    await fillRequiredCompanyFields(page, name, pan);

    // AGM Due Month — Select with no htmlFor/id link to its <Label>, scope
    // by the wrapping field div instead (same pattern as e2e/helpers/tasks.ts).
    const agmField = clientDialog(page).locator('div').filter({ hasText: 'AGM Due Month' }).last();
    await agmField.getByRole('combobox').click();
    await page.getByRole('option', { name: 'September', exact: true }).click();

    // Last Share Allotment Date — a DatePickerField button, its <Label>
    // *is* connected via htmlFor/id here, so getByLabel works.
    await clientDialog(page).getByLabel('Last Share Allotment Date').click();
    const dayCell = page.getByRole('gridcell', { name: '10', exact: true }).first();
    await expect(dayCell).toBeVisible({ timeout: 5_000 });
    await dayCell.click();

    await saveClientDialog(page);
    await expectToast(page, /client added/i, 15_000);
    await expect(clientDialog(page)).not.toBeVisible({ timeout: 8_000 });

    await searchClients(page, name);
    await openEditForClient(page, name);

    await expect(clientDialog(page).getByText('September', { exact: true })).toBeVisible();
    // DatePickerField displays dd/MM/yyyy — the picked day (10) is the
    // first segment, not embedded in the middle.
    const reopenedAllotmentBtn = clientDialog(page).getByLabel('Last Share Allotment Date');
    await expect(reopenedAllotmentBtn).not.toHaveText(/dd\/mm\/yyyy/i);
    await expect(reopenedAllotmentBtn).toContainText(/^10\//);
  });
});
