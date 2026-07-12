/**
 * e2e/helpers/clientProfile.ts
 * Navigation and interaction helpers for the Client Profile page,
 * including the (admin-only) Credentials / DSC Register tab.
 */
import { Page, Locator, expect } from '@playwright/test';
import { expectToast } from './auth';

export function clientProfileHeading(page: Page, clientName: string) {
  return page.getByRole('heading', { name: clientName, exact: true });
}

export function profileTab(page: Page, name: 'Overview' | 'Tasks' | 'Documents' | 'Billing' | 'Credentials' | 'Activity') {
  return page.getByRole('tab', { name, exact: true });
}

export function credentialsDialog(page: Page) {
  return page.getByRole('dialog');
}

export async function openAddPortalCredentialModal(page: Page) {
  await page.getByRole('button', { name: /^add$/i }).first().click();
  await expect(credentialsDialog(page).getByRole('heading', { name: 'Add Portal Credential' })).toBeVisible();
}

export interface PortalCredentialInput {
  portalName: string;
  username?: string;
  password?: string;
  notes?: string;
}

/** None of the Label/Input pairs in this panel's forms are connected via
 * htmlFor/id (same pattern as AddTaskModal etc.) — scope by the wrapping
 * div's label text instead of getByLabel. */
function credField(page: Page, label: string) {
  return credentialsDialog(page).locator('div').filter({ hasText: label }).last();
}

export async function fillPortalCredentialForm(page: Page, data: PortalCredentialInput) {
  await credField(page, 'Portal *').locator('input').fill(data.portalName);
  if (data.username) await credField(page, 'Username').locator('input').fill(data.username);
  if (data.password) await credField(page, 'Password').locator('input').fill(data.password);
  if (data.notes) await credField(page, 'Notes').locator('input').fill(data.notes);
}

export interface DscRecordInput {
  holderName: string;
  serial?: string;
  issuer?: string;
  tokenType?: string;
  validFrom?: string;
  validUntil?: string;
  pin?: string;
  notes?: string;
}

export async function fillDscRecordForm(page: Page, data: DscRecordInput) {
  await credField(page, 'Holder Name *').locator('input').fill(data.holderName);
  if (data.serial) await credField(page, 'Serial Number').locator('input').fill(data.serial);
  if (data.issuer) await credField(page, 'Issuing Authority').locator('input').fill(data.issuer);
  if (data.tokenType) await credField(page, 'Token Type').locator('input').fill(data.tokenType);
  if (data.validFrom) await credField(page, 'Valid From').locator('input').fill(data.validFrom);
  if (data.validUntil) await credField(page, 'Valid Until').locator('input').fill(data.validUntil);
  if (data.pin) await credField(page, 'Token PIN').locator('input').fill(data.pin);
  if (data.notes) await credField(page, 'Notes').locator('input').fill(data.notes);
}

export async function openAddDscModal(page: Page) {
  await page.getByRole('button', { name: /^add$/i }).nth(1).click();
  await expect(credentialsDialog(page).getByRole('heading', { name: 'Add DSC Record' })).toBeVisible();
}

/** Row for a given portal credential name, scoped by its unique `divide-y`
 * list-item structure (a flex row with the name in a <p>). */
export function portalCredentialRow(page: Page, portalName: string) {
  return page.locator('p.text-sm.font-medium', { hasText: portalName }).locator('xpath=ancestor::div[contains(@class,"flex items-center justify-between gap-3")][1]');
}

export function dscRecordRow(page: Page, holderName: string) {
  return page.locator('p.text-sm.font-medium', { hasText: holderName }).locator('xpath=ancestor::div[contains(@class,"flex items-center justify-between gap-3")][1]');
}

export async function revealField(row: Locator) {
  const eyeButton = row.locator('button:has(svg.lucide-eye)');
  await eyeButton.click();
}

export async function hideField(row: Locator) {
  const hideButton = row.locator('button:has(svg.lucide-eye-off)');
  await hideButton.click();
}

export async function saveCredentialDialog(page: Page) {
  await credentialsDialog(page).getByRole('button', { name: /^save$/i }).click();
}
