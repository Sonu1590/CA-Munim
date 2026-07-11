import { describe, expect, it } from "vitest";
import { computeInvoiceDueDate } from "@/hooks/useBilling";

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
