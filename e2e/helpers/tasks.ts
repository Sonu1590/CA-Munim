/**
 * e2e/helpers/tasks.ts
 * Navigation and interaction helpers for the Tasks & Deadlines module
 */
import { Page, Locator, expect } from '@playwright/test';
import { expectToast, waitForLoading } from './auth';

export function tasksPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'Tasks & Deadlines', exact: true });
}

export function tasksSearchInput(page: Page) {
  return page.getByPlaceholder('Search tasks or clients...');
}

/** Scopes to the page content, avoiding the sidebar's global FY combobox. */
export function tasksContent(page: Page) {
  return page.locator('div.p-4.md\\:p-6.space-y-4').first();
}

export function taskPriorityFilter(page: Page) {
  return tasksContent(page).getByRole('combobox');
}

export function taskViewTab(page: Page, view: 'Kanban' | 'List' | 'Calendar') {
  return page.getByRole('tab', { name: view });
}

export function taskDialog(page: Page) {
  return page.getByRole('dialog');
}

/** Shadcn Select fields in AddTaskModal are `<div class="space-y-2">` leaves
 * with a `<label>` and a `Select` — not connected via htmlFor/id, so scope by
 * the wrapping div's text instead of getByLabel. */
function taskField(page: Page, label: string) {
  return taskDialog(page).locator('div.space-y-2').filter({ hasText: label });
}

export async function goToTasks(page: Page) {
  await page.goto('/tasks');
  await waitForTasksPage(page);
}

export async function waitForTasksPage(page: Page) {
  await expect(tasksPageHeading(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Loading tasks...')).not.toBeVisible({ timeout: 15_000 });
  await waitForLoading(page);
}

export async function openAddTaskModal(page: Page) {
  await page.getByRole('button', { name: /^add task$/i }).click();
  await expect(taskDialog(page)).toBeVisible({ timeout: 5_000 });
  await expect(taskDialog(page).getByRole('heading', { name: 'Create New Task' })).toBeVisible();
}

export async function openBulkGenerateModal(page: Page) {
  await page.getByRole('button', { name: /bulk generate/i }).click();
  await expect(taskDialog(page)).toBeVisible({ timeout: 5_000 });
  await expect(taskDialog(page).getByRole('heading', { name: 'Generate Recurring Tasks' })).toBeVisible();
}

export async function selectTaskFieldOption(page: Page, label: string, optionName: string, exact = true) {
  await taskField(page, label).getByRole('combobox').click();
  await page.getByRole('option', { name: optionName, exact }).click();
}

export async function pickTaskDueDate(page: Page, day = '20') {
  await taskField(page, 'Due Date').getByRole('button').click();
  const dayCell = page.getByRole('gridcell', { name: day, exact: true });
  await expect(dayCell).toBeVisible({ timeout: 5_000 });
  await dayCell.click();
}

export interface TaskFormOptions {
  clientName: string;
  taskType?: string;
  financialYear?: string;
  period?: string;
  priority?: string;
  notes?: string;
  dueDateDay?: string;
}

/** Fills the Add/Edit Task modal. Does not submit. */
export async function fillTaskForm(page: Page, options: TaskFormOptions) {
  await selectTaskFieldOption(page, 'Client', options.clientName);
  await selectTaskFieldOption(page, 'Task Type', options.taskType ?? 'GST Filing');

  if (options.financialYear) {
    await selectTaskFieldOption(page, 'Financial Year', options.financialYear);
  }
  if (options.period) {
    await selectTaskFieldOption(page, 'Period', options.period, false);
  }

  await pickTaskDueDate(page, options.dueDateDay ?? '20');

  if (options.priority) {
    await selectTaskFieldOption(page, 'Priority', options.priority, false);
  }
  if (options.notes) {
    await taskDialog(page).getByPlaceholder('Additional notes...').fill(options.notes);
  }
}

export async function saveTaskDialog(page: Page, mode: 'create' | 'update' = 'create') {
  const name = mode === 'create' ? /^create task$/i : /^update task$/i;
  await taskDialog(page).getByRole('button', { name }).click();
}

export async function createTask(page: Page, options: TaskFormOptions) {
  await openAddTaskModal(page);
  await fillTaskForm(page, options);
  await saveTaskDialog(page, 'create');
  await expectToast(page, /task created successfully/i, 15_000);
  await expect(taskDialog(page)).not.toBeVisible({ timeout: 8_000 });
}

/** Kanban card for a given client — scoped from the clientName paragraph up
 * to its card wrapper, since TaskCard has no other unique hook.
 * `:visible` matters here: TaskKanbanBoard renders two DOM copies (a desktop
 * 3-column grid and a mobile single-column Tabs view), and Radix mounts the
 * mobile Tabs' default ("pending") panel regardless of viewport — so a
 * pending task's card exists twice in the DOM even on desktop, CSS-hidden
 * but still matched by a plain locator. */
export function taskCard(page: Page, clientName: string) {
  return page
    .locator('p.text-primary:visible', { hasText: clientName })
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

export function taskRow(page: Page, clientName: string) {
  return page.locator('table tbody tr', { hasText: clientName });
}

export async function searchTasks(page: Page, query: string) {
  await tasksSearchInput(page).fill(query);
}

/** Opens a task's "⋮" menu (kanban card or list row) and clicks an action. */
export async function chooseTaskMenuAction(taskItem: Locator, actionName: string | RegExp) {
  // The "⋮" dropdown trigger is the first button in DOM order — kanban cards
  // also have a second "docs" button further down, list rows have only one.
  await taskItem.getByRole('button').first().click();
  await taskItem.page().getByRole('menuitem', { name: actionName }).click();
}
