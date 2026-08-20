import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useTasks, type TaskFormData } from "@/hooks/useTasks";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockSupabase = vi.mocked(supabase, true);
const mockToast = vi.mocked(toast, true);

const FIRM_ID = "firm-1";

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    client_id: "client-1",
    task_type: "GSTR-3B",
    custom_name: null,
    financial_year: "FY 2025-26",
    period: "May",
    due_date: "2026-06-20",
    status: "pending",
    priority: "high",
    assigned_to: null,
    document_checklist: [],
    filing_reference: null,
    ack_number: null,
    notes: null,
    completed_at: null,
    created_at: "2026-05-01T00:00:00Z",
    clients: { name: "Amit Sharma" },
    staff: null,
    ...overrides,
  };
}

const validTaskForm: TaskFormData = {
  client_id: "client-1",
  task_type: "GSTR-3B",
  financial_year: "FY 2025-26",
  period: "May",
  due_date: "2026-06-20",
};

// useTasks (no status filter) fetches via .select().order() which resolves
// directly. Mutations use insert / update->eq / delete->eq. Terminal resolvers
// are overridable per test.
function setupSupabase(opts: {
  fetchResult?: { data: unknown; error: unknown };
  staffResult?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
  updateResult?: { error: unknown };
  deleteResult?: { error: unknown };
  user?: { id: string } | null;
} = {}) {
  const {
    fetchResult = { data: [taskRow()], error: null },
    staffResult = { data: { firm_id: FIRM_ID }, error: null },
    insertResult = { error: null },
    updateResult = { error: null },
    deleteResult = { error: null },
    user = { id: "user-1" },
  } = opts;

  mockSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null } as never);

  const tasksBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(fetchResult),
    insert: vi.fn().mockResolvedValue(insertResult),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(updateResult) }),
    delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(deleteResult) }),
  };
  const staffBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(staffResult),
  };

  mockSupabase.from.mockImplementation((table: string) =>
    (table === "staff" ? staffBuilder : tasksBuilder) as never,
  );

  return { tasksBuilder, staffBuilder };
}

async function mountTasks() {
  const view = renderHook(() => useTasks());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("useTasks mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addTask", () => {
    it("inserts with the resolved firm_id and returns true on success", async () => {
      const { tasksBuilder } = setupSupabase();
      const { result } = await mountTasks();

      let res: unknown;
      await act(async () => {
        res = await result.current.addTask(validTaskForm);
      });

      expect(res).toBe(true);
      expect(tasksBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ firm_id: FIRM_ID, client_id: "client-1", status: "pending", priority: "medium" }),
      );
    });

    it("returns false (not a throw) when the insert fails", async () => {
      setupSupabase({ insertResult: { error: new Error("rls denied") } });
      const { result } = await mountTasks();

      let res: unknown;
      await act(async () => {
        res = await result.current.addTask(validTaskForm);
      });

      expect(res).toBe(false);
    });

    it("returns false when the user is not authenticated (never reaches insert)", async () => {
      const { tasksBuilder } = setupSupabase({ user: null });
      const { result } = await mountTasks();

      let res: unknown;
      await act(async () => {
        res = await result.current.addTask(validTaskForm);
      });

      expect(res).toBe(false);
      expect(tasksBuilder.insert).not.toHaveBeenCalled();
    });
  });

  describe("updateTaskStatus", () => {
    it("optimistically applies the new status and keeps it on success", async () => {
      setupSupabase();
      const { result } = await mountTasks();
      expect(result.current.tasks[0].status).toBe("pending");

      let res: unknown;
      await act(async () => {
        res = await result.current.updateTaskStatus("task-1", "completed");
      });

      expect(res).toBe(true);
      expect(result.current.tasks[0].status).toBe("completed");
    });

    // M15/M19: a failed status update must roll the row back, not blank the
    // page, and it must surface an error toast.
    it("rolls the optimistic status back and toasts on failure", async () => {
      setupSupabase({ updateResult: { error: new Error("update failed") } });
      const { result } = await mountTasks();

      let res: unknown;
      await act(async () => {
        res = await result.current.updateTaskStatus("task-1", "completed");
      });

      expect(res).toBe(false);
      // Restored to the pre-mutation status; the list still has the task.
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].status).toBe("pending");
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update task status. Please try again.");
    });

    it("stamps completed_at only when moving to completed", async () => {
      const { tasksBuilder } = setupSupabase();
      const { result } = await mountTasks();

      await act(async () => {
        await result.current.updateTaskStatus("task-1", "completed");
      });
      expect(tasksBuilder.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "completed", completed_at: expect.any(String) }),
      );

      await act(async () => {
        await result.current.updateTaskStatus("task-1", "in_progress");
      });
      const lastArg = tasksBuilder.update.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(lastArg.status).toBe("in_progress");
      expect(lastArg.completed_at).toBeUndefined();
    });
  });

  describe("updateTask", () => {
    it("returns true on a successful field update", async () => {
      const { tasksBuilder } = setupSupabase();
      const { result } = await mountTasks();

      let res: unknown;
      await act(async () => {
        res = await result.current.updateTask("task-1", { notes: "call client" });
      });

      expect(res).toBe(true);
      expect(tasksBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ notes: "call client", updated_at: expect.any(String) }),
      );
    });

    it("returns false without throwing when the update fails", async () => {
      setupSupabase({ updateResult: { error: new Error("boom") } });
      const { result } = await mountTasks();

      let res: unknown;
      await act(async () => {
        res = await result.current.updateTask("task-1", { notes: "x" });
      });

      expect(res).toBe(false);
    });
  });

  describe("deleteTask", () => {
    it("optimistically removes the task and returns true on success", async () => {
      setupSupabase();
      const { result } = await mountTasks();
      expect(result.current.tasks).toHaveLength(1);

      let res: unknown;
      await act(async () => {
        res = await result.current.deleteTask("task-1");
      });

      expect(res).toBe(true);
      expect(result.current.tasks).toHaveLength(0);
    });

    it("restores the removed task and toasts when the delete fails", async () => {
      setupSupabase({ deleteResult: { error: new Error("fk violation") } });
      const { result } = await mountTasks();

      let res: unknown;
      await act(async () => {
        res = await result.current.deleteTask("task-1");
      });

      expect(res).toBe(false);
      // The optimistic removal was undone — task is back.
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].id).toBe("task-1");
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete task. Please try again.");
    });
  });

  describe("derived counts over a large task set", () => {
    it("computes overdueCount/dueThisWeek across a firm-scale list", async () => {
      // shouldAdvanceTime keeps waitFor's polling alive while the wall clock
      // stays pinned for the overdue/due-this-week arithmetic.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date("2026-06-15T00:00:00"));

      // 90 tasks: overdue (past, not completed), due-this-week, far-future,
      // and completed-but-overdue (must be excluded from overdue).
      const rows = Array.from({ length: 90 }, (_, i) => {
        const bucket = i % 3;
        if (bucket === 0) return taskRow({ id: `t-${i}`, due_date: "2026-06-01", status: "pending" }); // overdue
        if (bucket === 1) return taskRow({ id: `t-${i}`, due_date: "2026-06-18", status: "pending" }); // this week
        return taskRow({ id: `t-${i}`, due_date: "2026-06-01", status: "completed" }); // overdue but done
      });
      setupSupabase({ fetchResult: { data: rows, error: null } });

      const view = renderHook(() => useTasks());
      await waitFor(() => expect(view.result.current.loading).toBe(false));

      // 30 overdue-and-pending; the 30 completed-overdue are excluded.
      expect(view.result.current.overdueCount).toBe(30);
      expect(view.result.current.dueThisWeek).toBe(30);

      vi.useRealTimers();
    });
  });
});
