/**
 * src/test/components/tasks/TaskChecklistDrawer.test.tsx
 *
 * Documents a real, currently-unfixed bug found while auditing the app for
 * the same "shows success but performs no real mutation" pattern as
 * ISSUES.md C6 (the "Send Reminder" buttons) — TaskChecklistDrawer's
 * "Request N pending via WhatsApp" button is a 4th instance of the exact
 * same shape: `onClick={() => toast.success(...)}` with no await, no call
 * to any messaging function, and (proven below) no call to the component's
 * only real-mutation callback (`onUpdate`, which the parent wires to a real
 * `updateTask()` DB write — see src/pages/Tasks.tsx).
 *
 * This is a Vitest component test, not a Playwright E2E spec, because the
 * bug is unreachable through the app's current UI: TaskCard.tsx only mounts
 * TaskChecklistDrawer (and only enables the button that opens it) when
 * `task.documentChecklist.length > 0`, but every real task-creation path
 * (AddTaskModal, BulkTaskGenerator) always creates `document_checklist: []`,
 * and the drawer's own "Add document item" input is the *only* way to add
 * an item — which requires the drawer to already be open. There is no UI
 * path that reaches a non-empty checklist from a freshly created task, so
 * an E2E spec driving the real app UI cannot exercise this component at
 * all today. Rendering it directly with a seeded `items` prop is the
 * honest way to cover the actual bug without fabricating a UI path that
 * doesn't exist (see ISSUES.md C6 for the full writeup, including this
 * reachability caveat).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { TaskChecklistDrawer } from "@/components/tasks/TaskChecklistDrawer";
import { ChecklistItem } from "@/data/Tasks";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderDrawer(items: ChecklistItem[], onUpdate = vi.fn()) {
  render(
    <TaskChecklistDrawer
      open={true}
      onOpenChange={vi.fn()}
      taskId="task-1"
      taskName="GSTR-3B"
      clientName="Asha Sharma"
      items={items}
      onUpdate={onUpdate}
    />
  );
  return { onUpdate };
}

describe("TaskChecklistDrawer", () => {
  it('"Request N pending via WhatsApp" shows a success toast but never calls onUpdate — nothing is persisted or sent', () => {
    const { onUpdate } = renderDrawer([
      { id: "1", label: "PAN Card", received: false } as ChecklistItem,
      { id: "2", label: "Bank Statement", received: false } as ChecklistItem,
    ]);

    const requestBtn = screen.getByRole("button", { name: /request 2 pending via whatsapp/i });
    fireEvent.click(requestBtn);

    expect(toast.success).toHaveBeenCalledWith(
      "WhatsApp request sent to Asha Sharma",
      expect.objectContaining({
        description: expect.stringContaining("2 pending document(s)"),
      })
    );

    // The button's entire effect is the toast above: no real mutation, no
    // API call, nothing written back to the parent/DB. Contrast with the
    // checkbox/add/delete assertions below, which do call onUpdate — proving
    // this asymmetry is a bug in this one button, not a limitation of the
    // component's plumbing.
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not render the WhatsApp request button when every item is already received", () => {
    renderDrawer([{ id: "1", label: "PAN Card", received: true } as ChecklistItem]);
    expect(screen.queryByRole("button", { name: /pending via whatsapp/i })).not.toBeInTheDocument();
  });

  it("toggling a checklist item's received checkbox DOES call onUpdate — a genuine write, unlike the WhatsApp button", () => {
    const { onUpdate } = renderDrawer([
      { id: "1", label: "PAN Card", received: false } as ChecklistItem,
    ]);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [updatedItems] = onUpdate.mock.calls[0];
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0]).toMatchObject({ id: "1", received: true, source: "manual" });
  });

  it('adding a new item via "Add document item" DOES call onUpdate — the only real write path into the checklist', () => {
    const { onUpdate } = renderDrawer([]);

    fireEvent.change(screen.getByPlaceholderText("Add document item…"), {
      target: { value: "Form 26AS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "" })); // icon-only Plus button

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [updatedItems] = onUpdate.mock.calls[0];
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0]).toMatchObject({ label: "Form 26AS", received: false });
  });
});
