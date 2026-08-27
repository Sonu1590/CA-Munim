import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkSender } from "@/components/whatsapp/BulkSender";
import { fetchClientsFromSupabase, type Client } from "@/data/Clients";
import { fetchInvoicesFromSupabase } from "@/data/Billing";
import { fetchDocumentRequestsFromSupabase, type DocumentRequest } from "@/data/Documents";
import { fetchFirmProfileFromSupabase } from "@/data/Settings";
import { fetchMessageTemplatesFromSupabase, sendBulkWhatsAppMessages, type MessageTemplate } from "@/data/WhatsappApi";
import { FinancialYearProvider } from "@/context/financialYear";

// compileTemplateForClient is intentionally NOT mocked — using the real
// substitution logic is what proves the upload_link override actually reaches
// the compiled/sent text, not just that some override object was constructed.
vi.mock("@/data/Clients", () => ({ fetchClientsFromSupabase: vi.fn() }));
vi.mock("@/data/Billing", () => ({ fetchInvoicesFromSupabase: vi.fn() }));
vi.mock("@/data/Documents", () => ({ fetchDocumentRequestsFromSupabase: vi.fn() }));
vi.mock("@/data/Settings", () => ({ fetchFirmProfileFromSupabase: vi.fn() }));
vi.mock("@/data/WhatsappApi", async () => {
  const actual = await vi.importActual<typeof import("@/data/WhatsappApi")>("@/data/WhatsappApi");
  return { ...actual, fetchMessageTemplatesFromSupabase: vi.fn(), sendBulkWhatsAppMessages: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockClients = vi.mocked(fetchClientsFromSupabase);
const mockInvoices = vi.mocked(fetchInvoicesFromSupabase);
const mockDocRequests = vi.mocked(fetchDocumentRequestsFromSupabase);
const mockFirm = vi.mocked(fetchFirmProfileFromSupabase);
const mockTemplates = vi.mocked(fetchMessageTemplatesFromSupabase);
const mockSend = vi.mocked(sendBulkWhatsAppMessages);

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    name: "Amit Traders",
    type: "Individual",
    pan: "ABCDE1234F",
    phone: "919876543210",
    email: "amit@example.com",
    gstin: "",
    city: "Pune",
    state: "Maharashtra",
    servicesSubscribed: ["GST Returns"],
    activeTasks: 0,
    pendingFees: 0,
    feesOverdue: false,
    lastActivity: "2026-06-01",
    ...overrides,
  } as Client;
}

const documentsPendingTemplate: MessageTemplate = {
  id: "t-doc",
  name: "Documents Pending",
  category: "GST",
  body: "Dear {{client_name}}, please upload at: {{upload_link}}. Deadline: {{due_date}}",
  variables: ["client_name", "upload_link", "due_date"],
  isDefault: false,
};

function docRequest(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: "r1",
    clientId: "c1",
    clientName: "Amit Traders",
    documentType: "Bank Statement",
    dueDate: "2026-07-01",
    status: "pending",
    requestedOn: "2026-06-01",
    uploadToken: "tok123",
    ...overrides,
  };
}

async function renderAndGoToTemplateStep() {
  render(
    <FinancialYearProvider>
      <BulkSender />
    </FinancialYearProvider>,
  );
  await screen.findByText("Select Message Template");
}

async function selectTemplateAndAdvance(name: string) {
  fireEvent.click(await screen.findByText(name));
  fireEvent.click(screen.getByRole("button", { name: /Next/ }));
  await screen.findByText("Select Recipients");
}

describe("BulkSender — upload_link gating for document-request templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirm.mockResolvedValue(null as never);
    mockInvoices.mockResolvedValue([]);
    mockTemplates.mockResolvedValue([documentsPendingTemplate]);
  });

  it("grays out and blocks selecting a client with no pending document request", async () => {
    mockClients.mockResolvedValue([client({ id: "c1", name: "Amit Traders" }), client({ id: "c2", name: "No Request Co" })]);
    mockDocRequests.mockResolvedValue([docRequest({ clientId: "c1" })]); // only c1 has a request

    await renderAndGoToTemplateStep();
    await selectTemplateAndAdvance("Documents Pending");

    // The gating banner explains why.
    expect(screen.getByText(/needs a real pending document request/i)).toBeInTheDocument();

    const noRequestRow = screen.getByText("No Request Co").closest("div")!;
    const checkbox = within(noRequestRow.parentElement as HTMLElement).getByRole("checkbox");
    expect(checkbox).toBeDisabled();

    // Only the client with a real request is selectable/counted.
    expect(screen.getByText(/Select All \(1 of 2\)/)).toBeInTheDocument();
  });

  // This is the exact regression: before the fix, overridesFor never set
  // upload_link for Bulk Sender, so compileTemplateForClient's default ("N/A")
  // reached the actually-sent message regardless of a real pending request.
  it("sends the real /upload/<token> link, not N/A, when the client has a pending request", async () => {
    mockClients.mockResolvedValue([client({ id: "c1", name: "Amit Traders" })]);
    mockDocRequests.mockResolvedValue([docRequest({ clientId: "c1", uploadToken: "realtoken456", dueDate: "2026-07-15" })]);
    mockSend.mockResolvedValue([{ phone: "919876543210", success: true, wamid: "wamid1" }] as never);

    await renderAndGoToTemplateStep();
    await selectTemplateAndAdvance("Documents Pending");

    const row = screen.getByText("Amit Traders").closest("div")!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // -> Preview
    await screen.findByText(/please upload at:/i);

    // Preview itself must show the real link, not N/A.
    expect(screen.getByText(/realtoken456/)).toBeInTheDocument();
    expect(screen.queryByText(/upload at: N\/A/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next/ })); // -> Confirm
    fireEvent.click(await screen.findByRole("button", { name: /Send to \d+ Client/i }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    const [, , compiledTextByClientId] = mockSend.mock.calls[0];
    expect((compiledTextByClientId as Record<string, string>).c1).toEqual(expect.stringContaining("realtoken456"));
    expect((compiledTextByClientId as Record<string, string>).c1).not.toMatch(/N\/A/);
  });
});
