import { describe, expect, it } from "vitest";
import { bucketForDaysOverdue, computeReceivablesAging } from "@/data/Reports";
import type { Invoice } from "@/data/Billing";

const invoice = (overrides: Partial<Invoice>): Invoice => ({
  id: "inv-1",
  invoiceNumber: "INV-001",
  clientId: "client-1",
  clientName: "Test Client",
  clientState: "Maharashtra",
  invoiceDate: "2026-01-01",
  dueDate: "2026-01-01",
  financialYear: "FY 2025-26",
  lineItems: [],
  subtotal: 1000,
  cgst: 0,
  sgst: 0,
  igst: 0,
  grandTotal: 1000,
  gstApplicable: false,
  isSameState: false,
  status: "Sent",
  payments: [],
  amountPaid: 0,
  amountDue: 1000,
  ...overrides,
});

describe("bucketForDaysOverdue", () => {
  it("buckets boundary values into the correct range", () => {
    expect(bucketForDaysOverdue(0)).toBe("Current");
    expect(bucketForDaysOverdue(-5)).toBe("Current");
    expect(bucketForDaysOverdue(1)).toBe("1-30 days");
    expect(bucketForDaysOverdue(30)).toBe("1-30 days");
    expect(bucketForDaysOverdue(31)).toBe("31-60 days");
    expect(bucketForDaysOverdue(60)).toBe("31-60 days");
    expect(bucketForDaysOverdue(61)).toBe("61-90 days");
    expect(bucketForDaysOverdue(90)).toBe("61-90 days");
    expect(bucketForDaysOverdue(91)).toBe("90+ days");
    expect(bucketForDaysOverdue(500)).toBe("90+ days");
  });
});

describe("computeReceivablesAging", () => {
  const asOf = new Date("2026-07-10");

  it("excludes Draft and Cancelled invoices, and fully paid invoices", () => {
    const invoices = [
      invoice({ id: "1", status: "Draft", amountDue: 1000 }),
      invoice({ id: "2", status: "Cancelled", amountDue: 1000 }),
      invoice({ id: "3", status: "Paid", amountDue: 0 }),
      invoice({ id: "4", status: "Sent", amountDue: 500, dueDate: "2026-07-05" }),
    ];
    const result = computeReceivablesAging(invoices, asOf);
    expect(result.byClient).toHaveLength(1);
    expect(result.totalOutstanding).toBe(500);
  });

  it("buckets a single client's invoices across multiple age ranges", () => {
    const invoices = [
      invoice({ id: "1", clientId: "c1", clientName: "Aarav Traders", dueDate: "2026-07-08", amountDue: 200 }), // 2 days
      invoice({ id: "2", clientId: "c1", clientName: "Aarav Traders", dueDate: "2026-06-01", amountDue: 300 }), // 39 days
      invoice({ id: "3", clientId: "c1", clientName: "Aarav Traders", dueDate: "2026-01-01", amountDue: 100 }), // 190 days
    ];
    const result = computeReceivablesAging(invoices, asOf);
    expect(result.byClient).toHaveLength(1);
    const row = result.byClient[0];
    expect(row.buckets["1-30 days"]).toBe(200);
    expect(row.buckets["31-60 days"]).toBe(300);
    expect(row.buckets["90+ days"]).toBe(100);
    expect(row.total).toBe(600);
  });

  it("sorts clients by total outstanding descending", () => {
    const invoices = [
      invoice({ id: "1", clientId: "c1", clientName: "Small Debtor", amountDue: 100, dueDate: "2026-07-01" }),
      invoice({ id: "2", clientId: "c2", clientName: "Big Debtor", amountDue: 10000, dueDate: "2026-07-01" }),
    ];
    const result = computeReceivablesAging(invoices, asOf);
    expect(result.byClient[0].clientName).toBe("Big Debtor");
    expect(result.byClient[1].clientName).toBe("Small Debtor");
  });

  it("returns zeroed bucket totals and empty client list when nothing is outstanding", () => {
    const result = computeReceivablesAging([], asOf);
    expect(result.totalOutstanding).toBe(0);
    expect(result.byClient).toEqual([]);
    expect(result.bucketTotals.every((b) => b.amount === 0)).toBe(true);
  });
});
