import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CreateInvoiceModal } from "@/components/billing/CreateInvoiceModal";
import { FinancialYearProvider } from "@/context/financialYear";
import { useClients } from "@/hooks/useClients";
import { useBilling } from "@/hooks/useBilling";

vi.mock("@/hooks/useClients");

vi.mock("@/hooks/useBilling", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useBilling")>("@/hooks/useBilling");
  return { ...actual, useBilling: vi.fn() };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  },
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

function renderModal() {
  vi.mocked(useClients).mockReturnValue({
    clients: [{ id: "c1", name: "Acme Co", state: "Maharashtra" } as any],
  } as any);
  vi.mocked(useBilling).mockReturnValue({
    createInvoice: vi.fn(),
  } as any);

  return render(
    <FinancialYearProvider>
      <CreateInvoiceModal open onOpenChange={() => {}} />
    </FinancialYearProvider>,
  );
}

// M30, ISSUES.md — CreateInvoiceModal previously validated client/line-items
// via toast-only, submit-only checks that never said which row was wrong.
// These tests cover the fixed inline, per-row, collect-all-errors behavior.
describe("CreateInvoiceModal", () => {
  it("shows the client error and the first row's description/amount errors on submit", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Create Invoice" }));

    expect(screen.getByText("Client is required.")).toBeInTheDocument();
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
  });

  it("flags a zero amount as invalid and clears once a positive amount is entered", () => {
    renderModal();

    const amountInput = screen.getByPlaceholderText("₹ Amount");
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.blur(amountInput);

    expect(screen.getByText("Amount must be greater than ₹0.")).toBeInTheDocument();

    fireEvent.change(amountInput, { target: { value: "5000" } });
    expect(screen.queryByText("Amount must be greater than ₹0.")).not.toBeInTheDocument();
  });

  it("tracks errors per line-item row independently when a second row is added", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Add Row/i }));
    const descriptionInputs = screen.getAllByPlaceholderText(/Description/);
    expect(descriptionInputs).toHaveLength(2);

    fireEvent.change(descriptionInputs[0], { target: { value: "ITR Filing" } });
    fireEvent.blur(descriptionInputs[0]);
    fireEvent.blur(descriptionInputs[1]);

    const errors = screen.getAllByText("Description is required.");
    expect(errors).toHaveLength(1);
  });
});
