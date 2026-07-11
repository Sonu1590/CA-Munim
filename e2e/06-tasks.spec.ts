/**
 * e2e/06-tasks.spec.ts
 *
 * Tests Tasks & Deadlines module:
 * - Protected access and page layout
 * - Add Task modal validation and happy path
 * - Search and priority filter
 * - Edit task and status transitions (kanban + list)
 * - Delete task
 * - View switching (kanban/list/calendar)
 * - Financial Year default sourced from the sidebar FY switcher
 * - Bulk Task Generator wizard
 * - Mobile layout, navigation, and refresh
 */
import { test, expect } from '@playwright/test';
import { signIn, expectToast, TEST_TASK } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import {
  goToTasks,
  waitForTasksPage,
  tasksPageHeading,
  tasksSearchInput,
  taskPriorityFilter,
  taskViewTab,
  taskDialog,
  openAddTaskModal,
  openBulkGenerateModal,
  selectTaskFieldOption,
  fillTaskForm,
  saveTaskDialog,
  createTask,
  taskCard,
  taskRow,
  searchTasks,
  chooseTaskMenuAction,
} from './helpers/tasks';

test.describe('Tasks - access', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveURL('/login', { timeout: 8_000 });
  });

  test('loads for authenticated user', async ({ page }) => {
    await signIn(page);
    await goToTasks(page);
    await expect(page).toHaveURL('/tasks');
    await expect(tasksPageHeading(page)).toBeVisible();
  });
});

test.describe('Tasks - page layout', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToTasks(page);
  });

  test('shows header, search, filter, view tabs, and action buttons', async ({ page }) => {
    await expect(tasksPageHeading(page)).toBeVisible();
    await expect(tasksSearchInput(page)).toBeVisible();
    await expect(taskPriorityFilter(page)).toBeVisible();
    await expect(taskViewTab(page, 'Kanban')).toBeVisible();
    await expect(taskViewTab(page, 'List')).toBeVisible();
    await expect(taskViewTab(page, 'Calendar')).toBeVisible();
    await expect(page.getByRole('button', { name: /^add task$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /bulk generate/i })).toBeVisible();
  });

  test('does not show loading spinner after data loads', async ({ page }) => {
    await expect(page.getByText('Loading tasks...')).not.toBeVisible();
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
  });

  test('kanban is the default view with three columns', async ({ page }) => {
    await expect(taskViewTab(page, 'Kanban')).toHaveAttribute('data-state', 'active');
    // h3:visible — the mobile Tabs view's default "pending" panel also
    // mounts in the DOM (CSS-hidden) even on a desktop viewport, so a plain
    // text locator for "Pending" would match twice.
    await expect(page.locator('h3:visible', { hasText: 'Pending' })).toBeVisible();
    await expect(page.locator('h3:visible', { hasText: 'In Progress' })).toBeVisible();
    await expect(page.locator('h3:visible', { hasText: 'Completed / Filed' })).toBeVisible();
  });
});

test.describe('Tasks - add modal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await goToTasks(page);
  });

  test('opens with all required controls', async ({ page }) => {
    await openAddTaskModal(page);
    const dialog = taskDialog(page);
    await expect(dialog.getByText('Select client', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Select task type', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Financial Year')).toBeVisible();
    await expect(dialog.getByText('Period')).toBeVisible();
    await expect(dialog.getByText('Pick a due date')).toBeVisible();
    await expect(dialog.getByText('Priority')).toBeVisible();
    await expect(dialog.getByPlaceholder('Additional notes...')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^cancel$/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^create task$/i })).toBeVisible();
  });

  test('requires client and task type before creating', async ({ page }) => {
    await openAddTaskModal(page);
    await saveTaskDialog(page, 'create');
    await expectToast(page, /please select client and task type/i);
    await expect(taskDialog(page)).toBeVisible();
  });

  test('shows custom task name field only for "Other" task type', async ({ page }) => {
    await openAddTaskModal(page);
    await expect(taskDialog(page).getByPlaceholder('Enter custom task name')).not.toBeVisible();
    await selectTaskFieldOption(page, 'Task Type', 'Other', true);
    await expect(taskDialog(page).getByPlaceholder('Enter custom task name')).toBeVisible();
  });

  test('cancel closes modal without saving', async ({ page }) => {
    await openAddTaskModal(page);
    await taskDialog(page).getByRole('button', { name: /^cancel$/i }).click();
    await expect(taskDialog(page)).not.toBeVisible();
  });
});

test.describe('Tasks - workflow', () => {
  test('creates a task and shows it in the Pending kanban column', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name, taskType: 'GST Filing', priority: 'High' });

    await expect(taskCard(page, client.name)).toBeVisible({ timeout: 10_000 });
  });

  test('created task also appears in the list view with matching priority', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name, taskType: 'ITR Filing', priority: 'Urgent' });

    await taskViewTab(page, 'List').click();
    const row = taskRow(page, client.name);
    await expect(row).toBeVisible();
    await expect(row.getByText('urgent', { exact: true })).toBeVisible();
    await expect(row.getByText('Pending', { exact: true })).toBeVisible();
  });

  test('search filters tasks by client name', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name });

    await searchTasks(page, client.name);
    await expect(taskCard(page, client.name)).toBeVisible();

    await searchTasks(page, 'xyz_nonexistent_task_query_99999');
    await expect(taskCard(page, client.name)).not.toBeVisible();
  });

  test('priority filter narrows the visible tasks', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name, priority: 'Urgent' });
    await searchTasks(page, client.name);

    await taskPriorityFilter(page).click();
    await page.getByRole('option', { name: 'Urgent', exact: true }).click();
    await expect(taskCard(page, client.name)).toBeVisible();

    await taskPriorityFilter(page).click();
    await page.getByRole('option', { name: 'Low', exact: true }).click();
    await expect(taskCard(page, client.name)).not.toBeVisible();
  });
});

test.describe('Tasks - edit and status transitions', () => {
  test('edit modal opens pre-filled with the task client and can update it', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name, taskType: 'Audit', priority: 'Low' });
    await searchTasks(page, client.name);

    await chooseTaskMenuAction(taskCard(page, client.name), 'Edit');
    await expect(taskDialog(page).getByRole('heading', { name: 'Edit Task' })).toBeVisible();
    // Client is locked once a task exists (disabled select), task type carries over.
    await expect(taskDialog(page).getByText('Audit', { exact: true }).first()).toBeVisible();

    await selectTaskFieldOption(page, 'Priority', 'Urgent', false);
    await taskDialog(page).getByRole('button', { name: /^update task$/i }).click();
    await expectToast(page, /task updated successfully/i, 15_000);
  });

  test('moving a task to In Progress updates its column and status badge', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name });
    await searchTasks(page, client.name);

    await chooseTaskMenuAction(taskCard(page, client.name), 'Move to In Progress');
    await expect(page.locator('h3', { hasText: 'In Progress' })).toBeVisible();

    await taskViewTab(page, 'List').click();
    await expect(taskRow(page, client.name).getByText('In Progress', { exact: true })).toBeVisible();
  });

  test('marking a task completed moves it to the Completed column', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name });
    await searchTasks(page, client.name);

    await chooseTaskMenuAction(taskCard(page, client.name), 'Mark Completed');
    await taskViewTab(page, 'List').click();
    await expect(taskRow(page, client.name).getByText('Completed', { exact: true })).toBeVisible();
  });
});

test.describe('Tasks - delete', () => {
  test('deletes a task after confirmation', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await createTask(page, { clientName: client.name });
    await searchTasks(page, client.name);

    page.once('dialog', (dialog) => dialog.accept());
    await chooseTaskMenuAction(taskCard(page, client.name), 'Delete');

    await expectToast(page, /task deleted/i);
    await expect(taskCard(page, client.name)).not.toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Tasks - views', () => {
  test('switches between kanban, list, and calendar', async ({ page }) => {
    await signIn(page);
    await goToTasks(page);

    await taskViewTab(page, 'List').click();
    await expect(page.getByRole('columnheader', { name: 'Task' })).toBeVisible();

    await taskViewTab(page, 'Calendar').click();
    await expect(page.getByRole('button').filter({ has: page.locator('svg') }).first()).toBeVisible();

    await taskViewTab(page, 'Kanban').click();
    await expect(page.locator('h3:visible', { hasText: 'Pending' })).toBeVisible();
  });
});

test.describe('Tasks - financial year default', () => {
  test('Add Task modal defaults Financial Year to the sidebar-selected FY', async ({ page }) => {
    await signIn(page);
    await goToTasks(page);

    // Switch the global FY in the sidebar
    await page.locator('aside').getByRole('combobox').click();
    await page.getByRole('option', { name: TEST_TASK.financialYear, exact: true }).click();

    await openAddTaskModal(page);
    await expect(taskDialog(page).getByText(TEST_TASK.financialYear, { exact: true })).toBeVisible();
  });
});

test.describe('Tasks - bulk generate', () => {
  test('generates recurring tasks for one client across one month', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);

    await goToTasks(page);
    await openBulkGenerateModal(page);

    // Step 1 — filing type
    await taskDialog(page).getByText('Select type', { exact: true }).click();
    await page.getByRole('option', { name: TEST_TASK.type, exact: true }).click();
    await taskDialog(page).getByRole('button', { name: 'Next' }).click();

    // Step 2 — clients
    await expect(taskDialog(page).getByText('Select Clients')).toBeVisible();
    await taskDialog(page).getByText(client.name, { exact: true }).click();
    await taskDialog(page).getByRole('button', { name: 'Next' }).click();

    // Step 3 — months
    await expect(taskDialog(page).getByText('Select Months to Generate')).toBeVisible();
    await taskDialog(page).getByText(TEST_TASK.period, { exact: true }).click();
    await taskDialog(page).getByRole('button', { name: 'Next' }).click();

    // Step 4 — confirm
    await expect(taskDialog(page).getByText('Ready to Generate')).toBeVisible();
    await taskDialog(page).getByRole('button', { name: /^generate \d+ task/i }).click();

    await expectToast(page, /tasks? created successfully/i, 15_000);
    await expect(taskDialog(page)).not.toBeVisible({ timeout: 8_000 });

    await searchTasks(page, client.name);
    await expect(taskCard(page, client.name).or(taskRow(page, client.name))).toBeVisible({ timeout: 10_000 });
  });

  test('Next is disabled until a filing type is chosen', async ({ page }) => {
    await signIn(page);
    await goToTasks(page);
    await openBulkGenerateModal(page);
    await expect(taskDialog(page).getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

test.describe('Tasks - mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('kanban shows single-column tabs instead of a 3-column grid', async ({ page }) => {
    await signIn(page);
    await goToTasks(page);
    // The desktop grid wrapper is "hidden md:grid grid-cols-3" — target that
    // specific combo, since the mobile TabsList also happens to use
    // grid-cols-3 (one column per tab) and would otherwise be matched too.
    await expect(page.locator('div.md\\:grid.grid-cols-3').first()).not.toBeVisible();
    await expect(page.getByRole('tablist').filter({ hasText: /Pending/i })).toBeVisible();
  });
});

test.describe('Tasks - navigation', () => {
  test('sidebar Tasks & Deadlines link navigates to the page', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Tasks & Deadlines' }).click();
    await expect(page).toHaveURL('/tasks');
    await waitForTasksPage(page);
  });

  test('page survives refresh', async ({ page }) => {
    await signIn(page);
    await goToTasks(page);
    await page.reload();
    await waitForTasksPage(page);
    await expect(tasksPageHeading(page)).toBeVisible();
  });
});
