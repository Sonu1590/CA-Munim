import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchInvoicesFromSupabase } from "@/data/Billing";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

// fetchInvoicesFromSupabase chains .from().select().order() and resolves at
// .order().
function mockInvoicesQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const builder = { select: vi.fn().mockReturnThis(), order };
  mockSupabase.from.mockReturnValue(builder as never);
  return builder;
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    invoice_number: "INV-001",
    client_id: "client-1",
    invoice_date: "2026-06-01",
    due_date: "2026-06-30",
    financial_year: "FY 2025-26",
    line_items: [{ id: "li-1", description: "GST filing", sacCode: "9982", amount: 1000 }],
    subtotal: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    total: 1180,
    status: "sent",
    notes: "Thanks",
    payment_terms: "net_30",
    clients: { name: "Amit Sharma", state: "Maharashtra" },
    payments: [],
    ...overrides,
  };
}

describe("fetchInvoicesFromSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders invoices by invoice date descending", async () => {
    const builder = mockInvoicesQuery({ data: [], error: null });

    await fetchInvoicesFromSupabase();

    expect(mockSupabase.from).toHaveBeenCalledWith("invoices");
    expect(builder.order).toHaveBeenCalledWith("invoice_date", { ascending: false });
  });

  it("maps a GST invoice with intra-state CGST/SGST into the frontend shape", async () => {
    mockInvoicesQuery({ data: [invoiceRow()], error: null });

    const [inv] = await fetchInvoicesFromSupabase();

    expect(inv).toMatchObject({
      id: "inv-1",
      invoiceNumber: "INV-001",
      clientId: "client-1",
      clientName: "Amit Sharma",
      clientState: "Maharashtra",
      status: "Sent",
      grandTotal: 1180,
      gstApplicable: true,
      isSameState: true,
    });
    expect(inv.amountPaid).toBe(0);
    expect(inv.amountDue).toBe(1180);
  });

  it("normalizes DB status strings (incl. partially_paid) to display statuses", async () => {
    mockInvoicesQuery({
      data: [
        invoiceRow({ id: "a", status: "draft" }),
        invoiceRow({ id: "b", status: "partially_paid" }),
        invoiceRow({ id: "c", status: "OVERDUE" }),
        invoiceRow({ id: "d", status: "cancelled" }),
        invoiceRow({ id: "e", status: "unknown-value" }), // unmapped -> Draft
      ],
      error: null,
    });

    const invoices = await fetchInvoicesFromSupabase();

    expect(invoices.map((i) => i.status)).toEqual([
      "Draft",
      "Partially Paid",
      "Overdue",
      "Cancelled",
      "Draft",
    ]);
  });

  it("subtracts summed payments from the grand total and clamps amountDue at zero", async () => {
    mockInvoicesQuery({
      data: [
        invoiceRow({
          payments: [
            { id: "p1", amount: 500, mode: "UPI", reference: "r1", payment_date: "2026-06-05" },
            { id: "p2", amount: 800, mode: "NEFT", reference: "r2", payment_date: "2026-06-10" },
          ],
        }),
      ],
      error: null,
    });

    const [inv] = await fetchInvoicesFromSupabase();

    // Paid 1300 against a 1180 total — amountDue must not go negative.
    expect(inv.amountPaid).toBe(1300);
    expect(inv.amountDue).toBe(0);
    expect(inv.payments[0]).toMatchObject({ invoiceId: "inv-1", date: "2026-06-05", mode: "UPI" });
  });

  it("recomputes grandTotal from subtotal+taxes when total column is stale/lower", async () => {
    // total (1000) is not greater than subtotal (1000), so the fn recomputes
    // subtotal + cgst + sgst + igst = 1180 rather than trusting the column.
    mockInvoicesQuery({
      data: [invoiceRow({ total: 1000 })],
      error: null,
    });

    const [inv] = await fetchInvoicesFromSupabase();

    expect(inv.grandTotal).toBe(1180);
  });

  it("marks a non-GST invoice as not gstApplicable and inter-state when only IGST is present", async () => {
    mockInvoicesQuery({
      data: [
        invoiceRow({ id: "nogst", cgst: 0, sgst: 0, igst: 0, total: 1000, subtotal: 1000 }),
        invoiceRow({ id: "igst", cgst: 0, sgst: 0, igst: 180, total: 1180, subtotal: 1000 }),
      ],
      error: null,
    });

    const [nogst, igst] = await fetchInvoicesFromSupabase();

    expect(nogst.gstApplicable).toBe(false);
    expect(nogst.isSameState).toBe(false);
    expect(igst.gstApplicable).toBe(true);
    expect(igst.isSameState).toBe(false);
  });

  it("defaults dueDate to invoiceDate and blanks missing joins/columns", async () => {
    mockInvoicesQuery({
      data: [
        invoiceRow({
          due_date: null,
          clients: null,
          invoice_number: null,
          line_items: null,
          notes: null,
        }),
      ],
      error: null,
    });

    const [inv] = await fetchInvoicesFromSupabase();

    expect(inv.dueDate).toBe("2026-06-01");
    expect(inv.clientName).toBe("");
    expect(inv.clientState).toBe("");
    expect(inv.invoiceNumber).toBe("");
    expect(inv.lineItems).toEqual([]);
  });

  it("throws on query error rather than returning mock invoices", async () => {
    mockInvoicesQuery({ data: null, error: { message: "select failed" } });

    await expect(fetchInvoicesFromSupabase()).rejects.toEqual(
      expect.objectContaining({ message: "select failed" }),
    );
  });

  it("maps a large invoice set with per-row payment aggregation intact", async () => {
    const rows = Array.from({ length: 150 }, (_, i) =>
      invoiceRow({
        id: `inv-${i}`,
        invoice_number: `INV-${String(i).padStart(3, "0")}`,
        total: 1180,
        payments: [{ id: `p-${i}`, amount: i, mode: "UPI", reference: "r", payment_date: "2026-06-05" }],
      }),
    );
    mockInvoicesQuery({ data: rows, error: null });

    const invoices = await fetchInvoicesFromSupabase();

    expect(invoices).toHaveLength(150);
    expect(invoices[10].amountPaid).toBe(10);
    expect(invoices[10].amountDue).toBe(1170);
    expect(invoices[149].invoiceNumber).toBe("INV-149");
  });
});
