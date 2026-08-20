import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchComplianceTasksForClient,
  fetchTasksFromSupabase,
} from "@/data/Tasks";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

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
    notes: null,
    completed_at: null,
    created_at: "2026-05-01T00:00:00Z",
    clients: { name: "Amit Sharma" },
    staff: { name: "Priya Verma" },
    ...overrides,
  };
}

describe("fetchTasksFromSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders by due date ascending and applies no status filter by default", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnThis();
    const builder = { select: vi.fn().mockReturnThis(), order, eq };
    mockSupabase.from.mockReturnValue(builder as never);

    await fetchTasksFromSupabase();

    expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    expect(order).toHaveBeenCalledWith("due_date", { ascending: true });
    expect(eq).not.toHaveBeenCalled();
  });

  it("applies a status filter through .eq when one is supplied", async () => {
    // .order() returns the query object, then .eq() resolves it.
    const resolved = { data: [], error: null };
    const eq = vi.fn().mockResolvedValue(resolved);
    const query = { eq };
    const order = vi.fn().mockReturnValue(query);
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    await fetchTasksFromSupabase("completed");

    expect(eq).toHaveBeenCalledWith("status", "completed");
  });

  it("maps a DB row into the Task shape, resolving assignee and initials", async () => {
    const order = vi.fn().mockResolvedValue({ data: [taskRow()], error: null });
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    const [task] = await fetchTasksFromSupabase();

    expect(task).toMatchObject({
      id: "task-1",
      clientName: "Amit Sharma",
      clientId: "client-1",
      taskType: "GSTR-3B",
      financialYear: "FY 2025-26",
      dueDate: "2026-06-20",
      priority: "high",
      status: "pending",
      assignedTo: "Priya Verma",
      assignedInitials: "PV",
    });
  });

  it("classifies a Q-prefixed period as quarter and a month name as month", async () => {
    const order = vi
      .fn()
      .mockResolvedValue({
        data: [
          taskRow({ id: "q", period: "Q1 (Apr-Jun)" }),
          taskRow({ id: "m", period: "May" }),
        ],
        error: null,
      });
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    const [q, m] = await fetchTasksFromSupabase();

    expect(q.quarter).toBe("Q1 (Apr-Jun)");
    expect(q.month).toBeUndefined();
    expect(m.month).toBe("May");
    expect(m.quarter).toBeUndefined();
  });

  it("falls back through staff.name -> assigned_to -> 'Unassigned' for the assignee", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        taskRow({ id: "a", staff: null, assigned_to: "Raw Name" }),
        taskRow({ id: "b", staff: null, assigned_to: null }),
      ],
      error: null,
    });
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    const [a, b] = await fetchTasksFromSupabase();

    expect(a.assignedTo).toBe("Raw Name");
    expect(a.assignedInitials).toBe("RN");
    expect(b.assignedTo).toBe("Unassigned");
    // Single word -> single initial.
    expect(b.assignedInitials).toBe("U");
  });

  it("counts received/checked checklist items as docsReceived out of docsTotal", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        taskRow({
          document_checklist: [
            { id: "d1", label: "Bank statement", received: true },
            { id: "d2", label: "Invoice", checked: true },
            { id: "d3", label: "Ledger", received: false },
          ],
        }),
      ],
      error: null,
    });
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    const [task] = await fetchTasksFromSupabase();

    expect(task.docsReceived).toBe(2);
    expect(task.docsTotal).toBe(3);
  });

  it("defaults clientName and financialYear when the joins/columns are absent", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [taskRow({ clients: null, financial_year: null })],
      error: null,
    });
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    const [task] = await fetchTasksFromSupabase();

    expect(task.clientName).toBe("Unknown Client");
    expect(task.financialYear).toBe("");
  });

  it("throws on query error rather than returning mock tasks", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "rls denied" } });
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    await expect(fetchTasksFromSupabase()).rejects.toEqual(
      expect.objectContaining({ message: "rls denied" }),
    );
  });

  it("maps a large due-date-ordered task set at realistic size", async () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      taskRow({ id: `task-${i}`, period: i % 2 === 0 ? "Q1 (Apr-Jun)" : "June" }),
    );
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const builder = { select: vi.fn().mockReturnThis(), order };
    mockSupabase.from.mockReturnValue(builder as never);

    const tasks = await fetchTasksFromSupabase();

    expect(tasks).toHaveLength(120);
    expect(tasks[0].quarter).toBe("Q1 (Apr-Jun)");
    expect(tasks[1].month).toBe("June");
  });
});

describe("fetchComplianceTasksForClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits to an empty array when clientId or financialYear is missing", async () => {
    await expect(fetchComplianceTasksForClient("", "FY 2025-26")).resolves.toEqual([]);
    await expect(fetchComplianceTasksForClient("client-1", "")).resolves.toEqual([]);
    // No DB round-trip should happen for the short-circuit cases.
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("filters to the client + FY, excludes completed, and orders by due date", async () => {
    const order = vi.fn().mockResolvedValue({ data: [taskRow()], error: null });
    const neq = vi.fn().mockReturnValue({ order });
    const eqFy = vi.fn().mockReturnValue({ neq });
    const eqClient = vi.fn().mockReturnValue({ eq: eqFy });
    const builder = { select: vi.fn().mockReturnValue({ eq: eqClient }) };
    mockSupabase.from.mockReturnValue(builder as never);

    const result = await fetchComplianceTasksForClient("client-1", "FY 2025-26");

    expect(eqClient).toHaveBeenCalledWith("client_id", "client-1");
    expect(eqFy).toHaveBeenCalledWith("financial_year", "FY 2025-26");
    expect(neq).toHaveBeenCalledWith("status", "completed");
    expect(order).toHaveBeenCalledWith("due_date", { ascending: true });
    expect(result).toHaveLength(1);
  });

  it("throws when the compliance query errors", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const neq = vi.fn().mockReturnValue({ order });
    const eqFy = vi.fn().mockReturnValue({ neq });
    const eqClient = vi.fn().mockReturnValue({ eq: eqFy });
    const builder = { select: vi.fn().mockReturnValue({ eq: eqClient }) };
    mockSupabase.from.mockReturnValue(builder as never);

    await expect(fetchComplianceTasksForClient("client-1", "FY 2025-26")).rejects.toEqual(
      expect.objectContaining({ message: "boom" }),
    );
  });
});
