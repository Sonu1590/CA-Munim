import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkDocumentStatus } from "@/components/documents/BulkDocumentStatus";
import { fetchDocumentRequestsFromSupabase, type DocumentRequest } from "@/data/Documents";
import { sendQuickReminder } from "@/data/WhatsappApi";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FinancialYearProvider } from "@/context/financialYear";

vi.mock("@/data/Documents", () => ({ fetchDocumentRequestsFromSupabase: vi.fn() }));
vi.mock("@/data/WhatsappApi", () => ({ sendQuickReminder: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.mocked(fetchDocumentRequestsFromSupabase);
const mockSend = vi.mocked(sendQuickReminder);
const mockSupabase = vi.mocked(supabase, true);
const mockToast = vi.mocked(toast, true);

function request(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: "req-1",
    clientId: "c1",
    clientName: "Amit Traders",
    documentType: "Bank Statement",
    dueDate: "2026-06-20",
    status: "pending",
    requestedOn: "2026-06-01",
    ...overrides,
  };
}

function buildRequests(n: number): DocumentRequest[] {
  return Array.from({ length: n }, (_, i) =>
    request({ id: `req-${i}`, clientId: `c-${i}`, clientName: `Doc Client ${String(i).padStart(3, "0")}`, status: "pending" }),
  );
}

// Clicking Remind looks up the client's phone before sending.
function primePhoneLookup(phone = "919876543210") {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { phone }, error: null }),
  };
  mockSupabase.from.mockReturnValue(builder as never);
}

async function renderStatus(rows: DocumentRequest[]) {
  mockFetch.mockResolvedValue(rows);
  render(
    <FinancialYearProvider>
      <BulkDocumentStatus />
    </FinancialYearProvider>,
  );
  if (rows.length) {
    const desktop = within(await screen.findByTestId("desktop-doc-requests"));
    await waitFor(() => expect(desktop.getByText(rows[0].clientName)).toBeInTheDocument());
    return desktop;
  }
  return within(document.body);
}

describe("BulkDocumentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pending requests with client, document type and status", async () => {
    const desktop = await renderStatus([request({ clientName: "Amit Traders", documentType: "Bank Statement", status: "pending" })]);
    expect(desktop.getByText("Amit Traders")).toBeInTheDocument();
    expect(desktop.getByText("Bank Statement")).toBeInTheDocument();
    expect(desktop.getByText("pending")).toBeInTheDocument();
  });

  // C6: "Remind" must invoke the real sendQuickReminder path, not a bare
  // toast.success.
  it("sends a real reminder via sendQuickReminder after looking up the phone", async () => {
    primePhoneLookup("919876543210");
    mockSend.mockResolvedValue(undefined as never);
    const desktop = await renderStatus([request({ id: "r1", clientId: "c1", clientName: "Amit Traders" })]);

    fireEvent.click(desktop.getByRole("button", { name: /Remind/ }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    // Sent for the right client, with the looked-up phone and the docs template.
    expect(mockSend.mock.calls[0][0]).toMatchObject({ id: "c1", name: "Amit Traders", phone: "919876543210" });
    expect(mockSend.mock.calls[0][1]).toBe("Documents Pending");
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Reminder sent to Amit Traders"));
  });

  it("surfaces a send failure honestly instead of a fake success", async () => {
    primePhoneLookup();
    mockSend.mockRejectedValue(new Error("no template found"));
    const desktop = await renderStatus([request({ id: "r1", clientName: "Amit Traders" })]);

    fireEvent.click(desktop.getByRole("button", { name: /Remind/ }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("no template found"));
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("does not offer a reminder for already-submitted requests", async () => {
    const desktop = await renderStatus([request({ clientName: "Done Co", status: "submitted" })]);
    expect(desktop.queryByRole("button", { name: /Remind/ })).not.toBeInTheDocument();
  });

  // M27: pair the list with a firm-scale dataset and confirm it is paginated
  // (25/page), not rendered unbounded.
  it("bounds a 60-request list to 25 per page with pagination", async () => {
    const desktop = await renderStatus(buildRequests(60));

    expect(desktop.getByText("Doc Client 000")).toBeInTheDocument();
    expect(desktop.getByText("Doc Client 024")).toBeInTheDocument();
    expect(desktop.queryByText("Doc Client 025")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(desktop.queryByText("Doc Client 000")).not.toBeInTheDocument();
    expect(desktop.getByText("Doc Client 025")).toBeInTheDocument();
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
  });
});
