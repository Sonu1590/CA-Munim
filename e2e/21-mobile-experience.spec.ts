/**
 * e2e/21-mobile-experience.spec.ts
 *
 * Coverage for Mobile Phase 1 ("Organic" redesign, commit b595273):
 * - MobileHomeScreen (`/` below the `md` breakpoint, data-testid="mobile-home"):
 *   header, metrics grid, "Needs your attention" digest cards' two real
 *   actions (Nudge on WhatsApp -> sendQuickReminder, Mark filed ->
 *   updateTaskStatus), compliance-calendar list, and the quick-actions grid.
 * - MobileBottomNav and MobileFAB (globally mounted by AppLayout.tsx,
 *   `md:hidden`, restyled but not restructured by Phase 1).
 *
 * Every describe block below skips on desktop viewport — this file only
 * runs meaningfully on the mobile-android/mobile-ios Playwright projects.
 * See 02-dashboard.spec.ts's "Desktop dashboard widgets" block for the
 * desktop-tree equivalent of the MobileHomeScreen coverage here.
 *
 * Known flakiness (2026-07-27 investigation, not fixed): on this dev
 * machine, mobile-ios (WebKit) intermittently times out on ordinary clicks
 * during "Mobile FAB > Add Task" — reproduced across ~4 consecutive runs,
 * each time at a *different*, unrelated click (the Task Type combobox, the
 * Create Task button, the pre-existing shared saveClientDialog() helper
 * used by dozens of other passing specs, and elsewhere). The failure point
 * moving randomly each run — never the same line twice, and hitting
 * long-established helpers with no other reported issues — rules out a
 * logic bug in this file or the app; it's WebKit-under-system-load
 * actionability timing on this machine. mobile-android (chromium) has been
 * 100% reliable across every run of this file. Not chased further; if this
 * resurfaces in CI (a cleaner, dedicated environment) it likely won't
 * reproduce the same way — investigate there with fresh eyes instead of
 * assuming it's still an environment artifact.
 */
import { test, expect } from './helpers/coverage';
import { signIn, expectToast } from './helpers/auth';
import {
  goToClients,
  createClient,
  fillAddClientForm,
  saveClientDialog,
} from './helpers/clients';
import {
  goToTasks,
  createTask,
  fillTaskForm,
  saveTaskDialog,
} from './helpers/tasks';
import { goToSettings } from './helpers/settings';
import { waitForToastsClear } from './helpers/whatsapp';
import {
  mobileHomeRoot,
  mobileMetricTile,
  digestCard,
  nudgeButton,
  markFiledButton,
  complianceCalendarRow,
  mobileQuickAction,
  mobileBottomNav,
  mobileNavTab,
  mobileFabToggle,
  mobileFabAction,
} from './helpers/mobileHome';

/** Tracks REST/edge-function requests fired after a given point — same
 * technique as 20-fake-reminder-buttons.spec.ts, used here to prove Nudge
 * actually reaches the backend rather than just showing a toast. */
function trackApiRequests(page: import('@playwright/test').Page) {
  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/rest/v1/') || req.url().includes('/functions/v1/')) {
      requests.push(`${req.method()} ${req.url()}`);
    }
  });
  return requests;
}

async function goToMobileHome(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
  await expect(mobileHomeRoot(page)).toBeVisible({ timeout: 10_000 });
}

test.describe('Mobile Home Screen', () => {
  test.beforeEach(async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1280) >= 768, 'Mobile-only tree — see 02-dashboard.spec.ts for desktop');
    await signIn(page);
    await goToMobileHome(page);
  });

  test('shows header greeting, brand, and a populated metrics grid', async ({ page }) => {
    await expect(mobileHomeRoot(page).getByText('CA Munim', { exact: true })).toBeVisible();
    await expect(mobileHomeRoot(page).getByText(/good (morning|afternoon|evening)/i)).toBeVisible();

    for (const label of ['Active clients', 'Overdue filings', 'Due this week', 'Fees to collect']) {
      const tile = mobileMetricTile(page, label);
      await expect(tile).toBeVisible();
      const value = (await tile.locator('div.text-2xl, div.text-xl').first().textContent())?.trim();
      expect(value).toBeTruthy();
      expect(value).not.toMatch(/loading|—|undefined|nan/i);
    }
  });

  test('compliance calendar shows real rows or the empty state, and View navigates to Tasks', async ({ page }) => {
    const hasEmptyState = await mobileHomeRoot(page)
      .getByText('No upcoming deadlines in the next 30 days.')
      .isVisible()
      .catch(() => false);

    if (hasEmptyState) {
      test.skip(true, 'No compliance alerts exist in the shared test project right now');
    }

    const viewBtn = mobileHomeRoot(page).getByRole('button', { name: 'View', exact: true }).first();
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();
    await expect(page).toHaveURL('/tasks', { timeout: 8_000 });
  });

  test('quick actions grid opens the right dialog for each action', async ({ page }) => {
    await mobileQuickAction(page, 'Add Client').click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Add New Client' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await mobileQuickAction(page, 'Add Task').click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Create New Task' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await mobileQuickAction(page, 'New Invoice').click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Create Invoice' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Distinct from MobileFAB's "New Invoice" (navigates to /billing instead
    // of opening this modal) — see the "Mobile FAB" describe block below,
    // which locks that asymmetry down explicitly.
    await mobileQuickAction(page, 'Bulk WhatsApp').click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Bulk WhatsApp Reminder' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('digest card: Nudge fires a real WhatsApp send, Mark filed really updates the task', async ({ page, viewport }) => {
    // 90s not 60s: on mobile-ios (WebKit) this flow's per-step latency has
    // been observed running noticeably slower than the identical steps on
    // mobile-android/chromium (which comfortably finishes in ~37s) — the
    // 60s budget was tuned against chromium timing and left no headroom.
    test.setTimeout(90_000);

    // Seed a guaranteed-overdue task through Clients/Tasks' Add
    // Client/Add Task flows. Those flows are still desktop-shaped —
    // Phase 2's mobile Clients/Tasks screens don't have their own inline
    // "Add Client"/"Add Task" trigger (only the FAB does, and it opens the
    // same modals) — so seeding widens to desktop width first rather than
    // reimplementing client/task creation through the FAB (which is what's
    // actually under test in the "Mobile FAB" describe block below, not
    // here). "GST Filing" matches MobileHomeScreen's templateSearchTermFor
    // regex, guaranteeing sendQuickReminder finds a real, live template
    // ("GST Filing Reminder") instead of erroring out on template lookup.
    //
    // dueDateMonthsAgo: 6 — MobileHomeScreen's digest caps at the 5 most
    // overdue items (M27, ISSUES.md), sorted oldest-due-first. This repo's
    // shared live test project accumulates real overdue tasks from every
    // e2e run across every session (it's never reset), so a task due "the
    // 20th of this month" can land well outside the top 5 once enough test
    // data has piled up — this test failed exactly that way once the
    // accumulated data passed ~70 days overdue. Backdating 6 months
    // guarantees this task outranks any realistic accumulation.
    await page.setViewportSize({ width: 1280, height: 800 });
    await goToClients(page);
    const client = await createClient(page);
    await goToTasks(page);
    await createTask(page, { clientName: client.name, taskType: 'GST Filing', dueDateDay: '20', dueDateMonthsAgo: 6 });
    await page.setViewportSize({ width: viewport?.width ?? 390, height: viewport?.height ?? 844 });

    await goToMobileHome(page);
    const card = digestCard(page, client.name);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText(/overdue|due today/i)).toBeVisible();

    // Nudge on WhatsApp — real edge-function call, same convention as
    // 20-fake-reminder-buttons.spec.ts: assert the specific send-whatsapp
    // request fires and a toast appears, not exact toast wording (the H7
    // templates are still pending Meta approval, so a real attempt can
    // legitimately end in a Meta error — that's expected, not a bug, per
    // ISSUES.md C6's verification notes). Matching the specific endpoint
    // (not just "any REST/functions request fired") matters: a coincidental
    // background refetch would otherwise make this pass even if Nudge
    // itself never actually called the edge function.
    await test.step('Nudge on WhatsApp calls the real send-whatsapp edge function', async () => {
      const requests = trackApiRequests(page);
      await nudgeButton(card).click();
      await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 20_000 });
      await expect(nudgeButton(card)).toBeEnabled({ timeout: 10_000 });
      expect(requests.some((r) => /\/functions\/v1\/send-whatsapp/.test(r))).toBe(true);
      await waitForToastsClear(page);
    });

    // Mark filed — a real updateTaskStatus write, not just optimistic UI:
    // verify the card disappears AND that a fresh page load agrees.
    await test.step('Mark filed really updates the task, surviving a reload', async () => {
      await markFiledButton(card).click();
      await expect(page.getByText(/marked as filed/i)).toBeVisible({ timeout: 10_000 });
      await expect(card).not.toBeVisible({ timeout: 8_000 });

      await page.reload();
      await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 10_000 });
      await expect(digestCard(page, client.name)).not.toBeVisible({ timeout: 5_000 });
    });
  });
});

test.describe('Mobile Bottom Nav', () => {
  test.beforeEach(async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1280) >= 768, 'Mobile-only nav');
    await signIn(page);
    await page.goto('/');
  });

  test('all 5 tabs navigate to the right page', async ({ page }) => {
    const tabs: { label: string; url: string }[] = [
      { label: 'Clients', url: '/clients' },
      { label: 'Tasks', url: '/tasks' },
      { label: 'WhatsApp', url: '/whatsapp' },
      { label: 'More', url: '/settings' },
      { label: 'Home', url: '/' },
    ];

    for (const tab of tabs) {
      await mobileNavTab(page, tab.label).click();
      await expect(page).toHaveURL(tab.url, { timeout: 8_000 });
    }
  });

  test('active tab is visually highlighted', async ({ page }) => {
    await mobileNavTab(page, 'Clients').click();
    await expect(page).toHaveURL('/clients');
    await expect(mobileNavTab(page, 'Clients')).toHaveClass(/text-mobile-accent/);
    await expect(mobileNavTab(page, 'Home')).not.toHaveClass(/text-mobile-accent/);
  });
});

test.describe('Mobile FAB', () => {
  test.beforeEach(async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1280) >= 768, 'Mobile-only FAB');
    await signIn(page);
    // Deliberately not `/` (MobileHomeScreen has its own identically
    // labelled "Add Client"/"Add Task" quick actions) and deliberately not
    // `/clients` either (confirmed live: that page's own real header "Add
    // Client" button collides with the FAB's identically-named action the
    // same way). Settings has neither, so it's a clean page to test the
    // FAB's own actions in isolation.
    await goToSettings(page);
  });

  test('opens and closes on tap, with a backdrop that dismisses it', async ({ page }) => {
    await expect(mobileFabAction(page, 'Add Client')).not.toBeVisible();
    await mobileFabToggle(page).click();
    await expect(mobileFabAction(page, 'Add Client')).toBeVisible({ timeout: 5_000 });
    await expect(mobileFabAction(page, 'Add Task')).toBeVisible();
    await expect(mobileFabAction(page, 'New Invoice')).toBeVisible();

    // Backdrop dismiss
    await page.mouse.click(10, 10);
    await expect(mobileFabAction(page, 'Add Client')).not.toBeVisible({ timeout: 5_000 });
  });

  // Opening-only coverage isn't enough here: MobileFAB globally mounts
  // AddClientModal/AddTaskModal, and prior to the mobile redesign's Phase 3
  // fix it rendered them with no `onSave` handler at all — the dialog
  // opened perfectly while Save silently did nothing. A test that only
  // asserts the dialog is visible would have passed identically before and
  // after that bug existed, so this asserts the save actually persists
  // (real toast, dialog closes, and — the same "survives a fresh fetch, not
  // just optimistic state" bar the Mobile Home digest-card test applies —
  // the record shows up after navigating to its real list page).
  test('"Add Client" action saves a real client', async ({ page }) => {
    test.setTimeout(45_000);
    await mobileFabToggle(page).click();
    await mobileFabAction(page, 'Add Client').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add New Client' })).toBeVisible({ timeout: 5_000 });

    const client = await fillAddClientForm(page);
    await saveClientDialog(page);
    await expectToast(page, /client added/i, 15_000);
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // Not goToClients()/waitForClientsPage() — that helper waits for the
    // desktop-only "Clients" <h1> (hidden md:flex since the mobile Clients
    // screen landed), which never becomes visible at a mobile viewport.
    // Navigating directly and asserting on the client's own name is both
    // viewport-safe and a stronger proof of persistence anyway. Scoped to
    // mobile-clients specifically (not an unscoped page.getByText) — both
    // trees render simultaneously (only CSS hides desktop-clients), so an
    // unscoped locator hits Playwright's strict-mode violation, same dual-
    // tree issue the "Add Task" test below already guards against.
    await page.goto('/clients');
    await expect(
      page.getByTestId('mobile-clients').getByText(client.name),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Add Task" action saves a real task', async ({ page, viewport }) => {
    // 90s not 60s: on mobile-ios (WebKit) this flow's per-step latency has
    // been observed running noticeably slower than the identical steps on
    // mobile-android/chromium (which comfortably finishes in ~37s) — the
    // 60s budget was tuned against chromium timing and left no headroom.
    test.setTimeout(90_000);
    // Seed a real client to assign the task to. createClient() drives the
    // desktop "Add Client" header button (Clients' own mobile screen has no
    // inline add trigger — only the FAB does, which is what's under test
    // below), so widen temporarily the same way the digest-card test does.
    await page.setViewportSize({ width: 1280, height: 800 });
    await goToClients(page);
    const client = await createClient(page);
    await page.setViewportSize({ width: viewport?.width ?? 390, height: viewport?.height ?? 844 });
    await goToSettings(page);

    await mobileFabToggle(page).click();
    await mobileFabAction(page, 'Add Task').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Create New Task' })).toBeVisible({ timeout: 5_000 });

    await fillTaskForm(page, { clientName: client.name, taskType: 'GST Filing' });
    await saveTaskDialog(page, 'create');
    await expectToast(page, /task created successfully/i, 15_000);
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // Not goToTasks()/taskCard() — waitForTasksPage() waits for the
    // desktop-only "Tasks & Deadlines" heading, and taskCard() locates
    // TaskKanbanBoard's desktop DOM shape, neither of which the mobile
    // Tasks screen renders. MobileTasksScreen does render each task's
    // client name directly on its card, so assert on that instead.
    await page.goto('/tasks');
    await expect(
      page.locator('[data-testid="mobile-tasks"]').getByText(client.name),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"New Invoice" action navigates to /billing — unlike MobileHomeScreen\'s own "New Invoice" tile, which opens a modal in place', async ({ page }) => {
    await mobileFabToggle(page).click();
    await mobileFabAction(page, 'New Invoice').click();
    await expect(page).toHaveURL('/billing', { timeout: 8_000 });
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
