import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

// fetchClientsFromSupabase chains .from().select().eq().order() and resolves at
// .order(). This builder returns `this` for the intermediate links and a
// terminal { data, error } from .order().
function mockClientsQuery(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  };
  mockSupabase.from.mockReturnValue(builder as never);
  return builder;
}

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    name: "Mock Client Pvt Ltd",
    client_type: "Private Ltd",
    pan: "ABCDE1234F",
    phone: "9876543210",
    email: "mock@example.com",
    gstin: "27ABCDE1234F1Z5",
    city: "Mumbai",
    state: "Maharashtra",
    services_subscribed: ["GST Returns"],
    updated_at: "2026-05-09T10:30:00Z",
    tasks: [],
    invoices: [],
    ...overrides,
  };
}

describe("fetchClientsFromSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes the query to active clients ordered by name", async () => {
    const builder = mockClientsQuery({ data: [], error: null });

    await fetchClientsFromSupabase();

    expect(mockSupabase.from).toHaveBeenCalledWith("clients");
    expect(builder.eq).toHaveBeenCalledWith("is_active", true);
    expect(builder.order).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("maps snake_case columns into the frontend Client shape", async () => {
    mockClientsQuery({ data: [clientRow()], error: null });

    const [client] = await fetchClientsFromSupabase();

    expect(client).toMatchObject({
      id: "client-1",
      name: "Mock Client Pvt Ltd",
      type: "Private Ltd",
      pan: "ABCDE1234F",
      gstin: "27ABCDE1234F1Z5",
      city: "Mumbai",
      state: "Maharashtra",
      servicesSubscribed: ["GST Returns"],
    });
    // lastActivity is the date portion of updated_at only.
    expect(client.lastActivity).toBe("2026-05-09");
  });

  it("counts only non-completed tasks as activeTasks", async () => {
    mockClientsQuery({
      data: [
        clientRow({
          tasks: [
            { id: "t1", status: "pending" },
            { id: "t2", status: "in_progress" },
            { id: "t3", status: "completed" },
          ],
        }),
      ],
      error: null,
    });

    const [client] = await fetchClientsFromSupabase();

    expect(client.activeTasks).toBe(2);
  });

  it("sums only sent/overdue invoices into pendingFees and flags overdue separately", async () => {
    mockClientsQuery({
      data: [
        clientRow({
          invoices: [
            { total: 1000, status: "sent" },
            { total: 500, status: "overdue" },
            { total: 9999, status: "paid" }, // excluded from pendingFees
            { total: 200, status: "draft" }, // excluded from pendingFees
          ],
        }),
      ],
      error: null,
    });

    const [client] = await fetchClientsFromSupabase();

    expect(client.pendingFees).toBe(1500);
    expect(client.feesOverdue).toBe(true);
  });

  it("reports feesOverdue false when nothing is overdue", async () => {
    mockClientsQuery({
      data: [clientRow({ invoices: [{ total: 1000, status: "sent" }] })],
      error: null,
    });

    const [client] = await fetchClientsFromSupabase();

    expect(client.feesOverdue).toBe(false);
    expect(client.pendingFees).toBe(1000);
  });

  it("defaults nullable columns without throwing", async () => {
    mockClientsQuery({
      data: [
        clientRow({
          pan: null,
          phone: null,
          email: null,
          city: null,
          state: null,
          services_subscribed: null,
          updated_at: null,
          tasks: null,
          invoices: null,
        }),
      ],
      error: null,
    });

    const [client] = await fetchClientsFromSupabase();

    expect(client.pan).toBe("");
    expect(client.phone).toBe("");
    expect(client.email).toBe("");
    expect(client.city).toBe("");
    expect(client.state).toBe("");
    expect(client.servicesSubscribed).toEqual([]);
    expect(client.lastActivity).toBe("");
    expect(client.activeTasks).toBe(0);
    expect(client.pendingFees).toBe(0);
    expect(client.feesOverdue).toBe(false);
  });

  // Bug-class 2 (CLAUDE.md): several fetch fns silently `return mockX` on
  // error, masking wrong table/column names. fetchClientsFromSupabase does the
  // right thing (throws) — lock that in so a regression to a silent fallback
  // is caught.
  it("throws when the query errors instead of silently returning mock data", async () => {
    mockClientsQuery({ data: null, error: { message: "permission denied for table clients" } });

    await expect(fetchClientsFromSupabase()).rejects.toEqual(
      expect.objectContaining({ message: "permission denied for table clients" }),
    );
  });

  it("returns an empty list (not a crash) when data is null but there is no error", async () => {
    mockClientsQuery({ data: null, error: null });

    await expect(fetchClientsFromSupabase()).resolves.toEqual([]);
  });

  // Firm-scale dataset via a factory rather than a hand-typed array (repo
  // rule): a fetch that maps a variable-length list must be exercised at
  // realistic size, and each row's per-client aggregates must stay correct.
  it("maps a firm-scale (200-client) result set with per-row aggregates intact", async () => {
    const rows = Array.from({ length: 200 }, (_, i) =>
      clientRow({
        id: `client-${i}`,
        name: `Bulk Client ${String(i).padStart(3, "0")}`,
        tasks: [
          { id: `t-${i}-a`, status: "pending" },
          { id: `t-${i}-b`, status: "completed" },
        ],
        invoices: [{ total: 100 + i, status: "sent" }],
      }),
    );
    mockClientsQuery({ data: rows, error: null });

    const clients = await fetchClientsFromSupabase();

    expect(clients).toHaveLength(200);
    expect(clients.every((c) => c.activeTasks === 1)).toBe(true);
    expect(clients[199].pendingFees).toBe(299);
    expect(clients[199].name).toBe("Bulk Client 199");
  });
});
