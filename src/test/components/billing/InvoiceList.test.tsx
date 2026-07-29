import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvoiceList } from "@/components/billing/InvoiceList";
import type { Invoice } from "@/data/Billing";

// M27, ISSUES.md — same "fixed object + overrides, generalized to also
// take a count" convention as fixtures/dashboard.ts's buildDigestItems.
function buildInvoices(n: number): Invoice[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `bulk-invoice-${i}`,
    invoiceNumber: `INV-${String(i).padStart(3, "0")}`,
    clientId: `client-${i}`,
    clientName: `Bulk Client ${String(i).padStart(3, "0")}`,
    clientState: "Maharashtra",
    invoiceDate: "2026-07-01",
    dueDate: "2026-08-01",
    financialYear: "FY 2026-27",
    lineItems: [],
    subtotal: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    grandTotal: 1180,
    gstApplicable: true,
    isSameState: true,
    status: "Sent",
    payments: [],
    amountPaid: 0,
    amountDue: 1180,
  }));
}

describe("InvoiceList", () => {
  it("bounds a firm-scale (60 invoice) list to one page of 25 with working pagination", () => {
    render(<InvoiceList invoices={buildInvoices(60)} onRecordPayment={vi.fn()} />);
    const desktop = within(screen.getByTestId("desktop-invoices"));

    expect(desktop.getByText("INV-000")).toBeInTheDocument();
    expect(desktop.getByText("INV-024")).toBeInTheDocument();
    expect(desktop.queryByText("INV-025")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(desktop.queryByText("INV-000")).not.toBeInTheDocument();
    expect(desktop.getByText("INV-025")).toBeInTheDocument();
    expect(desktop.getByText("INV-049")).toBeInTheDocument();
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
  });

  it("shows the empty state for zero invoices", () => {
    render(<InvoiceList invoices={[]} onRecordPayment={vi.fn()} />);
    expect(screen.getByText(/No invoices found/i)).toBeInTheDocument();
  });
});
