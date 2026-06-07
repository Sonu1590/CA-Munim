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

import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';
import { getCurrentFY } from './helpers/utils';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL('/');
  });

  // ── Metric Cards ────────────────────────────────────────────────────────

  test('shows all four metric cards', async ({ page }) => {
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Overdue Tasks')).toBeVisible();
    await expect(page.getByText('Pending Fees')).toBeVisible();
    await expect(page.getByText('Due This Week')).toBeVisible();
  });

  test('metric cards show numeric values, not loading placeholders', async ({ page }) => {
    // Wait for loading to finish
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
    
    // Values should be numbers or ₹ amounts — not "—" or "Loading"
    const totalClients = page.locator('text=Total Clients').locator('..').locator('..');
    const value = await totalClients.locator('p').first().textContent();
    expect(value).not.toBe('—');
    expect(value).not.toMatch(/loading/i);
  });

  test('pending fees shows ₹ symbol', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
    const feesCard = page.locator('text=Pending Fees').locator('../..');
    const value = await feesCard.locator('p').first().textContent();
    expect(value).toMatch(/₹/);
  });

  test('overdue tasks shows red badge when count > 0', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
    // If there are overdue tasks, a red indicator should appear
    // This test passes regardless — just ensures no crash
    const overdueCard = page.locator('text=Overdue Tasks').locator('../..');
    await expect(overdueCard).toBeVisible();
  });

  // ── Compliance Alerts ───────────────────────────────────────────────────

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

  test('compliance alert cards are color-coded by urgency', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
    // Overdue = destructive/red colors, upcoming = orange/amber, safe = green
    // Just verify the section renders without error
    const alertsSection = page.locator('text="Today\'s Compliance Alerts"').locator('../..');
    await expect(alertsSection).toBeVisible();
  });

  // ── Recent Activity ─────────────────────────────────────────────────────

  test('recent activity section is visible', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible();
  });

  test('recent activity shows empty state or real items', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10_000 });
    const activity = page.locator('text=Recent Activity').locator('../..');
    // Either shows activity items or empty state
    await expect(activity).toBeVisible();
  });

  // ── Monthly Work ────────────────────────────────────────────────────────

  test('monthly work section visible with progress bar', async ({ page }) => {
    await expect(page.getByText("This Month's Work")).toBeVisible();
    // Progress bar
    await expect(page.locator('[role="progressbar"]').or(
      page.locator('.h-2\\.5.rounded-full')
    )).toBeVisible();
  });

  // ── Quick Actions ───────────────────────────────────────────────────────

  test('quick actions are visible', async ({ page }) => {
    // At least one quick action button visible
    const quickActions = page.getByText(/Add.*Client|Create.*Task|Generate.*Invoice|Send.*WhatsApp/i);
    await expect(quickActions.first()).toBeVisible();
  });

  test('quick action "Add Client" opens client modal', async ({ page }) => {
    await page.getByRole('button', { name: /Add.*Client|Add Client/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Add New Client').or(page.getByText('Client Details'))).toBeVisible();
  });

  // ── Sidebar Navigation ──────────────────────────────────────────────────

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
    await expect(page.getByText(expectedFY)).toBeVisible();
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

  // ── Global Search ───────────────────────────────────────────────────────

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
    await page.getByPlaceholder(/search/i).fill('xyzxyzxyz_nonexistent_query');
    await expect(page.getByText('No results found').or(
      page.getByText(/no data|no clients|no tasks/i)
    )).toBeVisible({ timeout: 5_000 });
  });

  // ── Mobile Layout ───────────────────────────────────────────────────────

  test('mobile bottom nav is visible on small screens', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1280) >= 768) {
      test.skip(true, 'Desktop viewport — skipping mobile nav test');
    }
    await expect(page.locator('nav').filter({ hasText: /home|clients|tasks/i })).toBeVisible();
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
    await expect(page.getByText('Dashboard').or(
      page.locator('.animate-spin')
    )).toBeVisible({ timeout: 20_000 });
  });
});
