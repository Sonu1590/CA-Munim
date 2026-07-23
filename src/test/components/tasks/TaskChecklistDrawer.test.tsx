/**
 * src/test/components/tasks/TaskChecklistDrawer.test.tsx
 *
 * TaskChecklistDrawer's "Request N pending via WhatsApp" button used to be a
 * 4th instance of the ISSUES.md C6 "shows success but performs no real
 * mutation" pattern: `onClick={() => toast.success(...)}` with no real send.
 * Now wired to sendQuickReminder (the same helper C6's FeesDashboard/
 * BulkDocumentStatus fixes use) via a real client-phone lookup.
 *
 * This is a Vitest component test, not a Playwright E2E spec, because the
 * button is unreachable through the app's current UI: TaskCard.tsx only
 * mounts TaskChecklistDrawer (and only enables the button that opens it)
 * when `task.documentChecklist.length > 0`, but every real task-creation
 * path (AddTaskModal, BulkTaskGenerator) always creates
 * `document_checklist: []`, and the drawer's own "Add document item" input
 * is the *only* way to add an item — which requires the drawer to already
 * be open. There is no UI path that reaches a non-empty checklist from a
 * freshly created task, so an E2E spec driving the real app UI cannot
 * exercise this component at all today (a real, separate, still-open gap —
 * see ISSUES.md C6). Rendering it directly with a seeded `items` prop is
 * the honest way to cover the fixed behavior without fabricating a UI path
 * that doesn't exist.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { TaskChecklistDrawer } from "@/components/tasks/TaskChecklistDrawer";
import { ChecklistItem } from "@/data/Tasks";
import { sendQuickReminder } from "@/data/WhatsappApi";
import { supabase } from "@/lib/supabase";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/data/WhatsappApi", () => ({
  sendQuickReminder: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);
const mockSendQuickReminder = vi.mocked(sendQuickReminder);

function mockClientPhoneLookup(phone: string | null, error: unknown = null) {
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: phone ? { phone } : null, error }),
      }),
    }),
  } as any);
}

function renderDrawer(items: ChecklistItem[], onUpdate = vi.fn()) {
  render(
    <TaskChecklistDrawer
      open={true}
      onOpenChange={vi.fn()}
      taskId="task-1"
      taskName="GSTR-3B"
      clientId="client-1"
      clientName="Asha Sharma"
      financialYear="FY 2026-27"
      items={items}
      onUpdate={onUpdate}
    />
  );
  return { onUpdate };
}

describe("TaskChecklistDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"Request N pending via WhatsApp" looks up the client\'s phone and sends a real reminder', async () => {
    mockClientPhoneLookup("9876543210");
    mockSendQuickReminder.mockResolvedValue(undefined);

    renderDrawer([
      { id: "1", label: "PAN Card", received: false } as ChecklistItem,
      { id: "2", label: "Bank Statement", received: false } as ChecklistItem,
    ]);

    const requestBtn = screen.getByRole("button", { name: /request 2 pending via whatsapp/i });
    fireEvent.click(requestBtn);

    await waitFor(() => expect(mockSendQuickReminder).toHaveBeenCalledTimes(1));
    expect(mockSendQuickReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "client-1", name: "Asha Sharma", phone: "9876543210" }),
      "Documents Pending",
      "FY 2026-27"
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "WhatsApp request sent to Asha Sharma",
        expect.objectContaining({ description: expect.stringContaining("2 pending document(s)") })
      )
    );
  });

  it("shows an error toast and does not call onUpdate when the send fails", async () => {
    mockClientPhoneLookup("9876543210");
    mockSendQuickReminder.mockRejectedValue(new Error("Meta rejected the template"));

    const { onUpdate } = renderDrawer([{ id: "1", label: "PAN Card", received: false } as ChecklistItem]);

    fireEvent.click(screen.getByRole("button", { name: /request 1 pending via whatsapp/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Meta rejected the template"));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not render the WhatsApp request button when every item is already received", () => {
    renderDrawer([{ id: "1", label: "PAN Card", received: true } as ChecklistItem]);
    expect(screen.queryByRole("button", { name: /pending via whatsapp/i })).not.toBeInTheDocument();
  });

  it("toggling a checklist item's received checkbox DOES call onUpdate — a genuine write", () => {
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
