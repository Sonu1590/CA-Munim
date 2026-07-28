/**
 * e2e/helpers/mobileHome.ts
 * Locators for the mobile-only Dashboard experience: MobileHomeScreen.tsx
 * (data-testid="mobile-home", `/` below the `md` breakpoint), plus the
 * globally-mounted MobileBottomNav and MobileFAB (AppLayout.tsx, every
 * page, `md:hidden`).
 */
import { Locator, Page } from '@playwright/test';

export function mobileHomeRoot(page: Page) {
  return page.locator('[data-testid="mobile-home"]');
}

/** One of the 4 metric tiles at the top, by its label (e.g. "Active clients"). */
export function mobileMetricTile(page: Page, label: string) {
  return mobileHomeRoot(page)
    .getByText(label, { exact: true })
    .locator('xpath=..');
}

/** A "Needs your attention" digest card, scoped by the client-name text and
 * walked up to its card wrapper — same pattern as helpers/tasks.ts's
 * taskCard(), which locates a distinctive text node then walks up rather
 * than guessing a stable class combo for the whole card. */
export function digestCard(page: Page, clientName: string) {
  return page
    .locator('div.text-xs.text-mobile-neutral-600', { hasText: clientName })
    .locator('xpath=ancestor::div[contains(@class,"rounded-mobile-md")][1]');
}

export function nudgeButton(card: Locator) {
  return card.getByRole('button', { name: /nudge on whatsapp/i });
}

export function markFiledButton(card: Locator) {
  return card.getByRole('button', { name: /mark filed/i });
}

/** A compliance-calendar row, scoped by filing type text. */
export function complianceCalendarRow(page: Page, filingType: string) {
  return mobileHomeRoot(page)
    .locator('div.border-mobile-divider', { hasText: filingType });
}

/** The "Quick actions" grid — scoped separately from MobileFAB's own
 * same-labelled actions ("Add Client"/"Add Task"), which are mounted
 * globally by AppLayout and would otherwise collide on an exact-name
 * lookup if the FAB happened to be open at the same time. */
export function mobileQuickActionsGrid(page: Page) {
  return mobileHomeRoot(page)
    .getByText('Quick actions', { exact: true })
    .locator('xpath=following-sibling::div[1]');
}

export function mobileQuickAction(page: Page, label: string) {
  return mobileQuickActionsGrid(page).getByRole('button', { name: label, exact: true });
}

export function mobileBottomNav(page: Page) {
  return page.locator('nav.fixed.bottom-0');
}

export function mobileNavTab(page: Page, label: string) {
  return mobileBottomNav(page).getByRole('link', { name: label, exact: true });
}

/** MobileFAB's own main toggle button — aria-label is static ("Quick add")
 * regardless of open/closed state; only the icon (Plus/X) swaps visually. */
export function mobileFabToggle(page: Page) {
  return page.getByRole('button', { name: 'Quick add', exact: true });
}

/** One of MobileFAB's 3 expanded actions, by its aria-label. Only
 * meaningful once the FAB is open. Callers should be on a page without
 * MobileHomeScreen mounted (i.e. not `/`) to avoid an ambiguous match
 * against its identically-labelled "Add Client"/"Add Task" quick actions. */
export function mobileFabAction(page: Page, label: string) {
  return page.getByRole('button', { name: label, exact: true });
}
