import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryStatus } from "@/components/whatsapp/DeliveryStatus";
import { fetchSentMessagesFromSupabase, type SentMessage } from "@/data/WhatsappApi";
import { FinancialYearProvider } from "@/context/financialYear";

vi.mock("@/data/WhatsappApi", () => ({
  fetchSentMessagesFromSupabase: vi.fn(),
  fetchMessageTemplatesFromSupabase: vi.fn(),
  sendBulkWhatsAppMessages: vi.fn(),
  compileTemplateForClient: vi.fn(),
}));
vi.mock("@/data/Clients", () => ({ fetchClientsFromSupabase: vi.fn() }));
vi.mock("@/data/Settings", () => ({ fetchFirmProfileFromSupabase: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.mocked(fetchSentMessagesFromSupabase);

function sent(overrides: Partial<SentMessage> = {}): SentMessage {
  return {
    id: "m1",
    clientId: "c1",
    clientName: "Amit Traders",
    phone: "919876543210",
    templateName: "GST Reminder",
    message: "Hello",
    sentAt: "2026-06-10T09:00:00Z",
    status: "sent",
    ...overrides,
  };
}

function buildSent(n: number): SentMessage[] {
  return Array.from({ length: n }, (_, i) =>
    sent({ id: `m-${i}`, clientId: `c-${i}`, clientName: `Sent Client ${String(i).padStart(3, "0")}`, status: "sent" }),
  );
}

async function renderStatus(rows: SentMessage[]) {
  mockFetch.mockResolvedValue(rows);
  render(
    <FinancialYearProvider>
      <DeliveryStatus />
    </FinancialYearProvider>,
  );
  if (rows.length) await waitFor(() => expect(screen.getByText(rows[0].clientName)).toBeInTheDocument());
}

describe("DeliveryStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sent messages with their status counts", async () => {
    await renderStatus([
      sent({ id: "a", clientName: "Amit Traders", status: "sent" }),
      sent({ id: "b", clientName: "Bela Co", status: "failed", failReason: "invalid number" }),
    ]);

    expect(screen.getByText("Amit Traders")).toBeInTheDocument();
    expect(screen.getByText("Bela Co")).toBeInTheDocument();
    // The four status summary cards render their counts.
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows a Retry affordance only for failed messages", async () => {
    await renderStatus([
      sent({ id: "ok", clientName: "Delivered Co", status: "delivered" }),
      sent({ id: "bad", clientName: "Failed Co", status: "failed", failReason: "blocked" }),
    ]);

    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("filters by client name via the search box", async () => {
    await renderStatus([
      sent({ id: "a", clientName: "Amit Traders" }),
      sent({ id: "b", clientName: "Bela Co" }),
    ]);

    fireEvent.change(screen.getByPlaceholderText("Search by client name..."), { target: { value: "Bela" } });

    expect(screen.getByText("Bela Co")).toBeInTheDocument();
    expect(screen.queryByText("Amit Traders")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no messages", async () => {
    await renderStatus([]);
    await waitFor(() => expect(screen.getByText("No messages found.")).toBeInTheDocument());
  });

  // M27: this list grows with every bulk send and has no fetch limit, so it is
  // bounded via a fixed-height scroll container rather than rendered unbounded.
  it("renders a 50-message dataset inside a bounded scroll container", async () => {
    await renderStatus(buildSent(50));

    expect(screen.getByText("Sent Client 000")).toBeInTheDocument();
    expect(screen.getByText("Sent Client 049")).toBeInTheDocument();

    // The list lives in a max-height overflow-scroll container (the M27 bound).
    const row = screen.getByText("Sent Client 049");
    const scroller = row.closest(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect((scroller as HTMLElement).className).toMatch(/max-h-\[/);
  });
});
