import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeInvoiceDueDate, useBilling } from "@/hooks/useBilling";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

describe("computeInvoiceDueDate", () => {
  it("due_on_receipt returns the invoice date unchanged", () => {
    expect(computeInvoiceDueDate("2026-06-21", "due_on_receipt")).toBe("2026-06-21");
  });

  it("net_15/30/45 add the corresponding number of days", () => {
    expect(computeInvoiceDueDate("2026-06-21", "net_15")).toBe("2026-07-06");
    expect(computeInvoiceDueDate("2026-06-21", "net_30")).toBe("2026-07-21");
    expect(computeInvoiceDueDate("2026-06-21", "net_45")).toBe("2026-08-05");
  });

  it("rolls over a month/year boundary correctly", () => {
    expect(computeInvoiceDueDate("2026-12-20", "net_15")).toBe("2027-01-04");
  });
});

// ── Mutation-path coverage ──────────────────────────────────────────────────

const FIRM_ID = "firm-1";

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    invoice_number: "INV-2025-0001",
    client_id: "client-1",
    invoice_date: "2026-06-01",
    due_date: "2026-06-16",
    financial_year: "FY 2025-26",
    line_items: [],
    subtotal: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    total: 1180,
    status: "draft",
    notes: null,
    payment_terms: "net_15",
    created_at: "2026-06-01T00:00:00Z",
    clients: { name: "Amit Sharma", state: "Maharashtra" },
    ...overrides,
  };
}

function setupSupabase(opts: {
  fetchResult?: { data: unknown; error: unknown };
  staffResult?: { data: unknown; error: unknown };
  updateResult?: { error: unknown };
  payInsertResult?: { error: unknown };
  invoiceTotalResult?: { data: unknown };
  paymentsListResult?: { data: unknown };
  user?: { id: string } | null;
} = {}) {
  const {
    fetchResult = { data: [invoiceRow()], error: null },
    staffResult = { data: { firm_id: FIRM_ID }, error: null },
    updateResult = { error: null },
    payInsertResult = { error: null },
    invoiceTotalResult = { data: { total: 1000 } },
    paymentsListResult = { data: [{ amount: 1000 }] },
    user = { id: "user-1" },
  } = opts;

  mockSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null } as never);

  const invoicesUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(updateResult) });
  const invoicesBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(fetchResult),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(invoiceTotalResult),
    update: invoicesUpdate,
  };
  const staffBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(staffResult),
  };
  const paymentsBuilder = {
    insert: vi.fn().mockResolvedValue(payInsertResult),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(paymentsListResult),
  };

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "staff") return staffBuilder as never;
    if (table === "payments") return paymentsBuilder as never;
    return invoicesBuilder as never;
  });

  return { invoicesBuilder, invoicesUpdate, staffBuilder, paymentsBuilder };
}

async function mountBilling() {
  const view = renderHook(() => useBilling());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("useBilling mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("markAsSent", () => {
    it("returns true and optimistically flips the row status to 'sent'", async () => {
      setupSupabase();
      const { result } = await mountBilling();
      expect(result.current.invoices[0].status).toBe("draft");

      let res: unknown;
      await act(async () => {
        res = await result.current.markAsSent("inv-1");
      });

      expect(res).toBe(true);
      expect(result.current.invoices[0].status).toBe("sent");
    });

    it("returns false and records the error message when the update fails", async () => {
      setupSupabase({ updateResult: { error: new Error("rls denied") } });
      const { result } = await mountBilling();

      let res: unknown;
      await act(async () => {
        res = await result.current.markAsSent("inv-1");
      });

      expect(res).toBe(false);
      expect(result.current.error).toBe("rls denied");
      // The optimistic flip must not have applied on failure.
      expect(result.current.invoices[0].status).toBe("draft");
    });
  });

  describe("recordPayment", () => {
    it("marks the invoice 'paid' when payments cover the total", async () => {
      const { invoicesUpdate, paymentsBuilder } = setupSupabase({
        invoiceTotalResult: { data: { total: 1000 } },
        paymentsListResult: { data: [{ amount: 1000 }] },
      });
      const { result } = await mountBilling();

      let res: unknown;
      await act(async () => {
        res = await result.current.recordPayment("inv-1", "client-1", 1000, "UPI", "ref-1");
      });

      expect(res).toBe(true);
      expect(paymentsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ firm_id: FIRM_ID, invoice_id: "inv-1", amount: 1000, mode: "UPI" }),
      );
      expect(invoicesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "paid" }),
      );
    });

    it("marks the invoice 'partially_paid' when payments fall short of the total", async () => {
      const { invoicesUpdate } = setupSupabase({
        invoiceTotalResult: { data: { total: 1000 } },
        paymentsListResult: { data: [{ amount: 400 }] },
      });
      const { result } = await mountBilling();

      await act(async () => {
        await result.current.recordPayment("inv-1", "client-1", 400, "Cash");
      });

      expect(invoicesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "partially_paid" }),
      );
    });

    it("returns false without throwing when the payment insert fails", async () => {
      setupSupabase({ payInsertResult: { error: new Error("insert blocked") } });
      const { result } = await mountBilling();

      let res: unknown;
      await act(async () => {
        res = await result.current.recordPayment("inv-1", "client-1", 500, "NEFT");
      });

      expect(res).toBe(false);
      expect(result.current.error).toBe("insert blocked");
    });
  });

  describe("createInvoice", () => {
    it("returns null (not a throw) when the user is unauthenticated", async () => {
      setupSupabase({ user: null });
      const { result } = await mountBilling();

      let res: unknown;
      await act(async () => {
        res = await result.current.createInvoice(
          { client_id: "client-1", invoice_date: "2026-06-01", financial_year: "FY 2025-26", line_items: [] },
          "GSTIN",
          "Maharashtra",
        );
      });

      expect(res).toBeNull();
      expect(result.current.error).toBe("Not authenticated");
    });
  });

  describe("stats over a large invoice set", () => {
    it("totals outstanding across a firm-scale list built from a factory", async () => {
      const rows = Array.from({ length: 120 }, (_, i) =>
        invoiceRow({
          id: `inv-${i}`,
          total: 100,
          // Cycle through statuses: sent/overdue/partially_paid count toward
          // outstanding; paid/draft/cancelled do not.
          status: ["sent", "overdue", "partially_paid", "paid", "draft", "cancelled"][i % 6],
        }),
      );
      setupSupabase({ fetchResult: { data: rows, error: null } });

      const { result } = await mountBilling();

      // 20 of each status; 3 of 6 statuses (60 invoices) are outstanding.
      expect(result.current.invoices).toHaveLength(120);
      expect(result.current.stats.totalOutstanding).toBe(60 * 100);
    });
  });
});
