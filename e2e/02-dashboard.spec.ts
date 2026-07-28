/**
 * e2e/02-dashboard.spec.ts
 *
 * Tests Dashboard (Index page):
 * - Metric cards render
 * - Compliance alerts
 * - Recent activity
 * - Monthly work chart
 * - Quick actions navigation
 * - Sidebar navigation
 * - Mobile bottom nav
 * - Global search (Cmd+K)
 * - FY badge is current
 */

import { test, expect } from './helpers/coverage';
import { signIn } from './helpers/auth';
import { getCurrentFY } from './helpers/utils';
import {
  metricCard,
  metricCardValue,
  dashboardSectionHeading,
  globalSearchDialog,
} from './helpers/dashboard';
import { clientDialog } from './helpers/clients';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL('/');
  });

  // Everything in this block is the desktop-only tree (`data-testid="desktop-dashboard"`,
  // `hidden md:block` in Index.tsx) — since Mobile Phase 1, `/` renders a
  // second, parallel `data-testid="mobile-home"` tree (MobileHomeScreen)
  // below the `md` breakpoint instead of a responsive reflow of this same
  // content, so these assertions are no longer meaningful (or even
  // reachable — the nodes exist but are `display:none`) on the
  // mobile-android/mobile-ios projects. See 21-mobile-experience.spec.ts
  // for the mobile-home equivalent of this coverage.
  test.describe('Desktop dashboard widgets', () => {
    test.beforeEach(async ({ viewport }) => {
      test.skip((viewport?.width ?? 1280) < 768, 'Desktop-only tree — see 21-mobile-experience.spec.ts');
    });

    // ── Metric Cards ──────────────────────────────────────────────────────

    // Unscoped page.getByText() is ambiguous here: since Mobile Phase 1, `/`
    // also renders a parallel `data-testid="mobile-home"` tree, and
    // MobileHomeScreen's own metric tiles use near-identical labels
    // ("Due this week" vs. "Due This Week") that getByText matches
    // case-insensitively regardless of which tree is CSS-hidden — a real
    // strict-mode failure caught by actually running this against the live
    // dual-tree DOM, not something jsdom's mocked unit tests would show.
    test('shows all four metric cards', async ({ page }) => {
      const desktop = page.getByTestId('desktop-dashboard');
      await expect(desktop.getByText('Total Clients')).toBeVisible();
      await expect(desktop.getByText('Overdue Tasks')).toBeVisible();
      await expect(desktop.getByText('Pending Fees')).toBeVisible();
      await expect(desktop.getByText('Due This Week')).toBeVisible();
    });

    test('metric cards show numeric values, not loading placeholders', async ({ page }) => {
      // Wait for loading to finish
      await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });

      // Values should be numbers or ₹ amounts — not "—" or "Loading"
      const value = await metricCardValue(page, 'Total Clients').textContent();
      expect(value).not.toBe('—');
      expect(value).not.toMatch(/loading/i);
    });

    test('pending fees shows ₹ symbol', async ({ page }) => {
      await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
      const value = await metricCardValue(page, 'Pending Fees').textContent();
      expect(value).toMatch(/₹/);
    });

    // MetricCards.tsx only renders the red "!" badge when
    // `metrics.overdueTasks > 0` (see the `badge:` field on the Overdue
    // Tasks card definition) — assert against the real live count instead
    // of just "the card exists", which passed unconditionally before and
    // would never have caught the badge logic breaking either way.
    test('overdue tasks shows a red "!" badge exactly when the live count is greater than zero', async ({ page }) => {
      await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });

      const rawValue = (await metricCardValue(page, 'Overdue Tasks').textContent())?.trim() ?? '';
      const overdueCount = Number(rawValue);
      expect(Number.isFinite(overdueCount)).toBe(true);

      const badge = metricCard(page, 'Overdue Tasks').locator('span.bg-destructive', { hasText: '!' });
      if (overdueCount > 0) {
        await expect(badge).toBeVisible();
      } else {
        await expect(badge).not.toBeVisible();
      }
    });

    // ── Compliance Alerts ─────────────────────────────────────────────────

    test('compliance alerts section is visible', async ({ page }) => {
      await expect(page.getByText("Today's Compliance Alerts")).toBeVisible();
    });

    test('compliance alert cards have Send Reminder buttons', async ({ page }) => {
      await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
      const alertCards = page.locator('button:has-text("Send Reminder")');
      const count = await alertCards.count();
      // Either shows alerts or shows "no upcoming deadlines" message
      if (count > 0) {
        await expect(alertCards.first()).toBeVisible();
      } else {
        await expect(page.getByText(/no.*deadline|no.*alert/i)).toBeVisible();
      }
    });

    // ComplianceAlerts.tsx only renders "N days overdue" text when
    // `daysUntilDue < 0`, and applies `border-destructive`/`bg-destructive`
    // (via `statusStyles.overdue`) to that same card — assert the real class
    // on a real overdue card instead of just re-checking the section renders.
    // Scoped to the compliance-alerts <section> specifically: TodayDigest
    // (a different section, higher up the page) also renders its own
    // "N days overdue" text, and its container's unrelated `divide-border`
    // utility class happens to satisfy a loose `contains(@class,"border")`
    // check — an unscoped locator silently asserted on the wrong section.
    test('overdue compliance alert cards carry the destructive/red style', async ({ page }) => {
      await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });

      const alertsSection = page.getByText("Today's Compliance Alerts").locator('xpath=ancestor::section[1]');
      const overdueLabel = alertsSection.getByText(/days overdue/i).first();
      const hasOverdue = await overdueLabel.isVisible().catch(() => false);
      if (!hasOverdue) {
        test.skip(true, 'No overdue compliance alerts in the shared test project right now');
      }

      const overdueCard = overdueLabel.locator('xpath=ancestor::div[contains(@class,"border-destructive")][1]');
      await expect(overdueCard).toBeVisible();
    });

    // ── Recent Activity ───────────────────────────────────────────────────

    test('recent activity section is visible', async ({ page }) => {
      await expect(dashboardSectionHeading(page, 'Recent Activity')).toBeVisible();
    });

    test('recent activity shows empty state or real items', async ({ page }) => {
      await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
      const activity = dashboardSectionHeading(page, 'Recent Activity').locator('..');
      // Either shows activity items or empty state
      await expect(activity).toBeVisible();
    });

    // ── Monthly Work ──────────────────────────────────────────────────────

    test('monthly work section visible with progress bar', async ({ page }) => {
      await expect(page.getByText("This Month's Work")).toBeVisible();
      // Progress bar
      await expect(page.locator('[role="progressbar"]').or(
        page.locator('.h-2\\.5.rounded-full')
      )).toBeVisible();
    });

    // ── Quick Actions ─────────────────────────────────────────────────────

    // Scoped to desktop-dashboard for the same reason as 'shows all four
    // metric cards' above — MobileHomeScreen has its own "Add Client"/
    // "Add Task"/"New Invoice"/"Bulk WhatsApp" quick-action tiles, and an
    // unscoped `.first()` can resolve to the CSS-hidden mobile copy.
    test('quick actions are visible', async ({ page }) => {
      const quickActions = page
        .getByTestId('desktop-dashboard')
        .getByText(/Add.*Client|Create.*Task|Generate.*Invoice|Send.*WhatsApp/i);
      await expect(quickActions.first()).toBeVisible();
    });

    test('quick action "Add Client" opens client modal', async ({ page }) => {
      await page.getByRole('button', { name: /Add.*Client|Add Client/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      await expect(
        clientDialog(page).getByRole('heading', { name: 'Add New Client' }),
      ).toBeVisible();
    });
  });

  // DesktopSidebar.tsx renders `<aside className="hidden md:flex ...">` —
  // every test below targets that element (or content only it renders, like
  // the "Sign out" button with `title="Sign out"`), so on mobile viewports
  // the sidebar is `display:none` and these either time out on `.click()`
  // (Playwright's actionability check refuses to click a hidden element) or
  // — worse — vacuously pass a `not.toBeVisible()` assertion for the wrong
  // reason (the whole tree is hidden, not because the thing being checked
  // resolved). Guarded the same way as the widgets block above.
  test.describe('Desktop sidebar', () => {
    test.beforeEach(async ({ viewport }) => {
      test.skip((viewport?.width ?? 1280) < 768, 'Desktop-only sidebar — mobile reaches these via bottom nav / Settings instead');
    });

    // ── Sidebar Navigation ────────────────────────────────────────────────

    test('desktop sidebar shows firm name', async ({ page }) => {
      // Should not show "Loading..." after auth resolves
      await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
      // Firm name area should not be empty or still loading
      const sidebar = page.locator('aside').first();
      const loadingText = sidebar.locator('text=Loading...');
      await expect(loadingText).not.toBeVisible({ timeout: 8_000 });
    });

    test('sidebar FY badge shows current financial year', async ({ page }) => {
      const expectedFY = getCurrentFY(); // e.g. "FY 2026-27"
      await expect(page.locator('aside').first().getByText(expectedFY)).toBeVisible();
    });

    test('sidebar navigation links work', async ({ page }) => {
      const navItems = [
        { name: 'Clients', url: '/clients' },
        { name: 'Tasks & Deadlines', url: '/tasks' },
        { name: 'Documents', url: '/documents' },
        { name: 'Billing & Fees', url: '/billing' },
        { name: 'Reports', url: '/reports' },
        { name: 'Settings', url: '/settings' },
      ];

      for (const item of navItems) {
        await page.getByRole('link', { name: item.name }).click();
        await expect(page).toHaveURL(item.url, { timeout: 8_000 });
        // Navigate back
        await page.goto('/');
      }
    });

    test('active sidebar link is highlighted', async ({ page }) => {
      // Dashboard link should be highlighted when on /
      const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
      // Check it has the active class (bg-primary)
      await expect(dashboardLink).toHaveClass(/bg-primary/, { timeout: 5_000 });
    });

    test('sign out button in sidebar works', async ({ page }) => {
      const logoutBtn = page.locator('[title="Sign out"]');
      await logoutBtn.click();
      await expect(page).toHaveURL('/login', { timeout: 8_000 });
    });
  });

  // ── Global Search ───────────────────────────────────────────────────────
  // Mounted globally in App.tsx with a viewport-independent keydown
  // listener (not gated behind `hidden md:block`) — these run on every
  // project, mobile included.

  test('Ctrl+K opens global search', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('Cmd+K opens global search on Mac', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('global search closes on Escape', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('global search shows empty state when no data', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await globalSearchDialog(page).getByPlaceholder(/search/i).fill('xyzxyzxyz_nonexistent_query');
    await expect(
      globalSearchDialog(page).getByText(/no results found/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Mobile Layout ───────────────────────────────────────────────────────

  test('mobile bottom nav is visible on small screens', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1280) >= 768) {
      test.skip(true, 'Desktop viewport — skipping mobile nav test');
    }
    // DesktopSidebar.tsx's <nav> also contains "Clients"/"Tasks..." link
    // text, so an unscoped filter({ hasText }) matches both it and the
    // real bottom nav — a strict-mode violation even though the sidebar is
    // CSS-hidden at this viewport. MobileBottomNav.tsx is the only `<nav>`
    // with this exact class combination.
    await expect(page.locator('nav.fixed.bottom-0')).toBeVisible();
  });

  // ── Loading States ──────────────────────────────────────────────────────

  test('dashboard does not show spinner after data loads', async ({ page }) => {
    // Wait for all spinners to disappear
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
  });

  test('page title is CA Munim', async ({ page }) => {
    await expect(page).toHaveTitle(/CA Munim/i);
  });

  // ── Error Resilience ────────────────────────────────────────────────────

  test('dashboard survives slow network — no crash', async ({ page }) => {
    // Throttle network
    await page.route('**/*', (route) => {
      setTimeout(() => route.continue(), 500); // 500ms delay on all requests
    });
    await page.reload();
    // Should show loading then content, not crash
    await expect(
      page.getByRole('heading', { name: 'Dashboard' }).or(
        page.getByText('Loading dashboard...'),
      ).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
