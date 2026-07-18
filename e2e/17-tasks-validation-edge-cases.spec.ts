/**
 * e2e/17-tasks-validation-edge-cases.spec.ts
 *
 * Form-validation / error-handling edge cases in Tasks not already covered
 * by 06-tasks.spec.ts.
 *
 * The one test here documents a real, currently-unfixed bug (ISSUES.md
 * M19) rather than asserting ideal behavior — see the comment on it. Once
 * fixed, the assertions should flip to: an inline validation error (or a
 * toast), the Add Task dialog and the rest of the Tasks page remaining
 * usable, and no full-page error screen.
 */
import { test, expect } from './helpers/coverage';
import { signIn } from './helpers/auth';
import { createClient, goToClients } from './helpers/clients';
import { goToTasks, openAddTaskModal, selectTaskFieldOption, saveTaskDialog, taskDialog } from './helpers/tasks';

test.describe('Tasks - due date validation', () => {
  // ISSUES.md M19: AddTaskModal.handleSave only requires client + task
  // type — Due Date has no required-field check, so an empty string
  // reaches the database (tasks.due_date is a typed `date` column, and
  // PostgREST doesn't coerce "" to NULL). The insert fails with Postgres
  // 22007 ("invalid input syntax for type date"), and — this is the part
  // that makes it worth a dedicated test rather than just "add a required
  // check someday" — useTasks.ts's addTask/updateTask/updateTaskStatus/
  // deleteTask all funnel their errors into the *same* setError() the
  // initial page-load fetch uses, so Tasks.tsx's `if (error)` early return
  // replaces the entire page (kanban/list/calendar, search, filters, the
  // dialog itself) with a generic "Try Again" screen instead of just
  // showing a toast and leaving the page usable, which is how every other
  // mutation failure in this app behaves.
  test('creating a task with no due date fails the whole page, not just the dialog (M19)', async ({ page }) => {
    await signIn(page);
    await goToClients(page);
    const client = await createClient(page);
    await goToTasks(page);

    await openAddTaskModal(page);
    await selectTaskFieldOption(page, 'Client', client.name);
    await selectTaskFieldOption(page, 'Task Type', 'GST Filing');
    // Deliberately not picking a due date.
    await saveTaskDialog(page, 'create');

    // Today: the whole Tasks board disappears behind a generic error
    // screen — this is the bug. A fixed version of this app should instead
    // show an inline "Due date is required" message and keep the dialog
    // (and the page behind it) open and usable.
    await expect(taskDialog(page)).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible({ timeout: 10_000 });

    // The page does recover via "Try Again" — confirms this isn't a hard
    // crash, just a UX regression that loses whatever view the user had.
    await page.getByRole('button', { name: 'Try Again' }).click();
    await goToTasks(page); // re-assert the board is back to normal
  });
});
