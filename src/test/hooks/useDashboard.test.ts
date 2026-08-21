import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboard } from "@/hooks/useDashboard";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

// useDashboard.fetchAll fires six queries in parallel, several against the same
// `tasks` table with different chains. A single "smart" thenable builder routes
// each query to the right result by inspecting which chain methods were called
// and whether it was a HEAD count query. Every query is also recorded so tests
// can assert the exact date-window boundaries passed to gte/lte/lt.
interface QueryConfig {
  clientCount?: number;
  overdueCount?: number;
  weekCount?: number;
  pendingInvoices?: { total: number }[];
  complianceRows?: { id: string; task_type: string; due_date: string; client_id: string }[];
  digestRows?: unknown[] | null;
  activityTasks?: unknown[];
  activityInvoices?: unknown[];
  activityDocs?: unknown[];
  monthlyRows?: { id: string; task_type: string; status: string }[];
  staff?: unknown;
}

interface CapturedQuery {
  table: string;
  methods: Set<string>;
  head: boolean;
  filters: { lt?: string; lte?: string; gte?: string; limit?: number };
}

function resolveForTable(table: string, q: CapturedQuery, cfg: QueryConfig) {
  const m = q.methods;
  if (table === "clients") return { count: cfg.clientCount ?? 0, error: null };
  if (table === "staff") return { data: cfg.staff ?? null, error: null };
  if (table === "documents") return { data: cfg.activityDocs ?? [], error: null };
  if (table === "invoices") {
    if (m.has("in")) return { data: cfg.pendingInvoices ?? [], error: null };
    return { data: cfg.activityInvoices ?? [], error: null };
  }
  if (table === "tasks") {
    if (q.head) {
      if (m.has("lt")) return { count: cfg.overdueCount ?? 0, error: null };
      return { count: cfg.weekCount ?? 0, error: null };
    }
    if (m.has("eq")) return { data: cfg.activityTasks ?? [], error: null };
    if (m.has("limit")) return { data: cfg.digestRows === undefined ? [] : cfg.digestRows, error: null };
    if (m.has("order")) return { data: cfg.complianceRows ?? [], error: null };
    return { data: cfg.monthlyRows ?? [], error: null };
  }
  return { data: [], error: null };
}

function setupDashboard(cfg: QueryConfig = {}) {
  const captured: CapturedQuery[] = [];

  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null } as never);

  mockSupabase.from.mockImplementation((table: string) => {
    const q: CapturedQuery = { table, methods: new Set(), head: false, filters: {} };
    const record = () => {
      captured.push(q);
      return resolveForTable(table, q, cfg);
    };
    const b: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        q.methods.add("select");
        if ((args[1] as { head?: boolean } | undefined)?.head === true) q.head = true;
        return b;
      },
      eq: () => (q.methods.add("eq"), b),
      neq: () => (q.methods.add("neq"), b),
      in: () => (q.methods.add("in"), b),
      not: () => (q.methods.add("not"), b),
      lt: (_c: string, v: string) => (q.methods.add("lt"), (q.filters.lt = v), b),
      lte: (_c: string, v: string) => (q.methods.add("lte"), (q.filters.lte = v), b),
      gte: (_c: string, v: string) => (q.methods.add("gte"), (q.filters.gte = v), b),
      order: () => (q.methods.add("order"), b),
      limit: (n: number) => (q.methods.add("limit"), (q.filters.limit = n), b),
      single: () => Promise.resolve(record()),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(record()).then(onF, onR),
    };
    return b as never;
  });

  return { captured };
}

async function mountDashboard(cfg: QueryConfig = {}) {
  const { captured } = setupDashboard(cfg);
  const view = renderHook(() => useDashboard());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return { ...view, captured };
}

// Pin the wall clock to noon UTC so both `now` and `now + 7d` serialize to an
// unambiguous calendar date via toISOString(), independent of the machine's
// local timezone (en-IN / Asia/Kolkata here).
const PINNED = new Date("2026-06-15T12:00:00Z");

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("fetchMetrics", () => {
    it("aggregates the four headline metrics from their respective queries", async () => {
      const { result } = await mountDashboard({
        clientCount: 42,
        overdueCount: 7,
        weekCount: 3,
        pendingInvoices: [{ total: 1000 }, { total: 2500 }, { total: 500 }],
      });

      expect(result.current.metrics).toEqual({
        totalClients: 42,
        overdueTasks: 7,
        pendingFees: 4000,
        dueThisWeek: 3,
      });
    });

    it("uses a [today, today+7] inclusive window for 'Due this week' and today for overdue", async () => {
      const { captured } = await mountDashboard({ weekCount: 3, overdueCount: 2 });

      const weekQuery = captured.find((q) => q.table === "tasks" && q.head && q.methods.has("gte"));
      const overdueQuery = captured.find((q) => q.table === "tasks" && q.head && q.methods.has("lt"));

      expect(weekQuery?.filters.gte).toBe("2026-06-15");
      expect(weekQuery?.filters.lte).toBe("2026-06-22");
      // Overdue is strictly before today (exclusive lower bound is "today").
      expect(overdueQuery?.filters.lt).toBe("2026-06-15");
    });

    it("reports a genuine zero for 'Due this week' when the count is 0 (a real state, not an error)", async () => {
      const { result } = await mountDashboard({ weekCount: 0, overdueCount: 0, clientCount: 10 });

      expect(result.current.metrics.dueThisWeek).toBe(0);
      expect(result.current.metrics.overdueTasks).toBe(0);
      expect(result.current.metrics.totalClients).toBe(10);
    });

    it("treats a null count / null invoice list as zero without throwing (bug-class 2: silent degrade)", async () => {
      // clientCount/overdueCount/weekCount default to 0; pendingInvoices omitted.
      const { result } = await mountDashboard({});

      expect(result.current.metrics).toEqual({
        totalClients: 0,
        overdueTasks: 0,
        pendingFees: 0,
        dueThisWeek: 0,
      });
    });
  });

  describe("fetchComplianceAlerts", () => {
    it("groups by task_type+due_date, counts clients affected, and classifies urgency", async () => {
      const { result } = await mountDashboard({
        complianceRows: [
          // Two clients, same filing + due date -> one alert, clientsAffected 2.
          { id: "1", task_type: "GSTR-3B", due_date: "2026-06-14", client_id: "c1" },
          { id: "2", task_type: "GSTR-3B", due_date: "2026-06-14", client_id: "c2" },
          { id: "3", task_type: "GSTR-1", due_date: "2026-06-22", client_id: "c3" }, // 7 days -> upcoming
          { id: "4", task_type: "ITR Filing", due_date: "2026-06-23", client_id: "c4" }, // 8 days -> safe
        ],
      });

      const alerts = result.current.complianceAlerts;
      const overdue = alerts.find((a) => a.filingType === "GSTR-3B");
      const upcoming = alerts.find((a) => a.filingType === "GSTR-1");
      const safe = alerts.find((a) => a.filingType === "ITR Filing");

      expect(overdue).toMatchObject({ clientsAffected: 2, urgency: "overdue" });
      expect(overdue!.daysUntilDue).toBeLessThan(0);
      expect(upcoming?.urgency).toBe("upcoming");
      expect(safe?.urgency).toBe("safe");
      // Sorted overdue-first (ascending daysUntilDue).
      expect(alerts[0].filingType).toBe("GSTR-3B");
    });

    it("caps compliance alerts at 10 even for a large, distinct-group dataset", async () => {
      // 50 distinct groups (unique type+date). Factory-built, not hand-typed.
      const rows = Array.from({ length: 50 }, (_, i) => ({
        id: `t-${i}`,
        task_type: `TYPE-${i}`,
        due_date: `2026-06-${String((i % 27) + 1).padStart(2, "0")}`,
        client_id: `c-${i}`,
      }));
      const { result } = await mountDashboard({ complianceRows: rows });

      expect(result.current.complianceAlerts).toHaveLength(10);
    });
  });

  describe("fetchDigest", () => {
    it("maps overdue/due-today tasks and computes daysOverdue (clamped at 0)", async () => {
      const { result } = await mountDashboard({
        digestRows: [
          { id: "d1", task_type: "GSTR-3B", due_date: "2026-06-10", client_id: "c1", clients: { name: "Amit" } },
          { id: "d2", task_type: "GSTR-1", due_date: "2026-06-15", client_id: "c2", clients: { name: "Bela" } },
          { id: "d3", task_type: "ITR", due_date: "2026-06-20", client_id: "c3", clients: null },
        ],
      });

      const digest = result.current.digest;
      expect(digest).toHaveLength(3);
      expect(digest[0]).toMatchObject({ id: "d1", clientName: "Amit", daysOverdue: 5 });
      expect(digest[1]).toMatchObject({ id: "d2", daysOverdue: 0 });
      // Future due date clamps to 0 rather than going negative, and a missing
      // join falls back to a placeholder client name.
      expect(digest[2]).toMatchObject({ daysOverdue: 0, clientName: "Unknown client" });
    });

    it("bounds the digest query at 50 rows and maps a full 50-item page", async () => {
      const rows = Array.from({ length: 50 }, (_, i) => ({
        id: `d-${i}`,
        task_type: "GSTR-3B",
        due_date: "2026-06-01",
        client_id: `c-${i}`,
        clients: { name: `Client ${i}` },
      }));
      const { result, captured } = await mountDashboard({ digestRows: rows });

      expect(result.current.digest).toHaveLength(50);
      const digestQuery = captured.find(
        (q) => q.table === "tasks" && q.methods.has("limit") && !q.methods.has("eq"),
      );
      // The unbounded-list guard: the query itself is limited to 50.
      expect(digestQuery?.filters.limit).toBe(50);
    });

    it("sets an empty digest (not a crash) when the query returns null data", async () => {
      const { result } = await mountDashboard({ digestRows: null });
      expect(result.current.digest).toEqual([]);
    });
  });

  describe("fetchMonthlyWork", () => {
    it("normalizes task types into broad categories and counts completed", async () => {
      const { result } = await mountDashboard({
        monthlyRows: [
          { id: "1", task_type: "GSTR-3B", status: "completed" },
          { id: "2", task_type: "GSTR-1", status: "pending" },
          { id: "3", task_type: "ITR Filing", status: "completed" },
          { id: "4", task_type: "24Q", status: "pending" },
          { id: "5", task_type: "MGT-7", status: "pending" },
          { id: "6", task_type: "Bookkeeping", status: "pending" },
        ],
      });

      const mw = result.current.monthlyWork;
      expect(mw.total).toBe(6);
      expect(mw.completed).toBe(2);
      const byType = Object.fromEntries(mw.byType.map((b) => [b.name, b.count]));
      expect(byType).toEqual({ GST: 2, ITR: 1, TDS: 1, ROC: 1, Other: 1 });
    });
  });

  describe("fetchActivity", () => {
    it("merges tasks, invoices and documents into a single timeline sorted newest-first", async () => {
      const { result } = await mountDashboard({
        activityTasks: [{ id: "t1", task_type: "GSTR-3B", completed_at: "2026-06-14T10:00:00Z", clients: { name: "Amit" } }],
        activityInvoices: [{ id: "i1", invoice_number: "INV-1", total: 5000, created_at: "2026-06-15T09:00:00Z", clients: { name: "Bela" } }],
        activityDocs: [{ id: "doc1", file_name: "pan.pdf", created_at: "2026-06-13T08:00:00Z", clients: { name: "Chetan" } }],
      });

      const activity = result.current.activity;
      expect(activity.map((a) => a.type)).toEqual(["invoice", "task", "document"]);
      expect(activity[0].description).toContain("INV-1");
      expect(activity[1].description).toContain("GSTR-3B filed for Amit");
    });

    it("caps the merged activity feed at 10 items for a large dataset", async () => {
      const big = (prefix: string, n: number) =>
        Array.from({ length: n }, (_, i) => ({
          id: `${prefix}-${i}`,
          task_type: "GSTR-3B",
          invoice_number: `INV-${i}`,
          file_name: `f${i}.pdf`,
          total: 100,
          completed_at: `2026-06-${String((i % 27) + 1).padStart(2, "0")}T10:00:00Z`,
          created_at: `2026-06-${String((i % 27) + 1).padStart(2, "0")}T10:00:00Z`,
          clients: { name: `Client ${i}` },
        }));
      const { result } = await mountDashboard({
        activityTasks: big("t", 8),
        activityInvoices: big("i", 8),
        activityDocs: big("d", 8),
      });

      expect(result.current.activity).toHaveLength(10);
    });
  });

  describe("fetchFirmInfo", () => {
    it("resolves firm and CA name from the staff+firms join", async () => {
      const { result } = await mountDashboard({
        staff: { name: "Priya Verma", firms: { name: "Verma & Co", ca_name: "CA Verma" } },
      });

      expect(result.current.firmName).toBe("Verma & Co");
      expect(result.current.caName).toBe("CA Verma");
    });

    it("falls back to the staff member's own name when the firm has no ca_name", async () => {
      const { result } = await mountDashboard({
        staff: { name: "Priya Verma", firms: { name: "Verma & Co", ca_name: null } },
      });

      expect(result.current.caName).toBe("Priya Verma");
    });
  });
});
