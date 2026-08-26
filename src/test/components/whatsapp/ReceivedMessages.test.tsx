import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceivedMessages } from "@/components/whatsapp/ReceivedMessages";
import { fetchReceivedMessagesFromSupabase, markReceivedMessageRead, type ReceivedMessage } from "@/data/WhatsappApi";

vi.mock("@/data/WhatsappApi", () => ({
  fetchReceivedMessagesFromSupabase: vi.fn(),
  markReceivedMessageRead: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.mocked(fetchReceivedMessagesFromSupabase);
const mockMarkRead = vi.mocked(markReceivedMessageRead);

function received(overrides: Partial<ReceivedMessage> = {}): ReceivedMessage {
  return {
    id: "r1",
    clientId: "c1",
    clientName: "Amit Traders",
    phone: "919876543210",
    message: "Please find my documents attached.",
    receivedAt: "2026-06-10T09:00:00Z",
    isRead: false,
    ...overrides,
  };
}

function buildReceived(n: number): ReceivedMessage[] {
  return Array.from({ length: n }, (_, i) =>
    received({ id: `r-${i}`, clientId: `c-${i}`, clientName: `Inbox Client ${String(i).padStart(3, "0")}`, isRead: true }),
  );
}

async function renderInbox(rows: ReceivedMessage[]) {
  mockFetch.mockResolvedValue(rows);
  render(<ReceivedMessages />);
  if (rows.length) await waitFor(() => expect(screen.getByText(rows[0].clientName)).toBeInTheDocument());
}

describe("ReceivedMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders received messages with sender and body", async () => {
    await renderInbox([received({ clientName: "Amit Traders", message: "Docs attached" })]);
    expect(screen.getByText("Amit Traders")).toBeInTheDocument();
    expect(screen.getByText("Docs attached")).toBeInTheDocument();
  });

  it("shows a 'Mark all as read' control with the unread count", async () => {
    await renderInbox([
      received({ id: "a", clientName: "Unread One", isRead: false }),
      received({ id: "b", clientName: "Unread Two", isRead: false }),
    ]);

    expect(screen.getByRole("button", { name: /Mark all as read \(2\)/ })).toBeInTheDocument();
  });

  it("marks a single message read via markReceivedMessageRead", async () => {
    mockMarkRead.mockResolvedValue(undefined as never);
    await renderInbox([received({ id: "r9", clientName: "Amit Traders", isRead: false })]);

    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));

    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith("r9"));
  });

  it("hides the bulk control when everything is already read", async () => {
    await renderInbox([received({ clientName: "Read Client", isRead: true })]);
    expect(screen.queryByRole("button", { name: /Mark all as read/ })).not.toBeInTheDocument();
  });

  it("filters by client name / message via search", async () => {
    await renderInbox([
      received({ id: "a", clientName: "Amit Traders", message: "gst docs" }),
      received({ id: "b", clientName: "Bela Co", message: "itr docs" }),
    ]);

    fireEvent.change(screen.getByPlaceholderText("Search messages..."), { target: { value: "Bela" } });

    expect(screen.getByText("Bela Co")).toBeInTheDocument();
    expect(screen.queryByText("Amit Traders")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no received messages", async () => {
    await renderInbox([]);
    await waitFor(() => expect(screen.getByText("No received messages.")).toBeInTheDocument());
  });

  // M27: inbound-message list grows unbounded, so it is bounded via a
  // fixed-height scroll container rather than rendered unbounded.
  it("renders a 50-message dataset inside a bounded scroll container", async () => {
    await renderInbox(buildReceived(50));

    expect(screen.getByText("Inbox Client 000")).toBeInTheDocument();
    const row = screen.getByText("Inbox Client 049");
    const scroller = row.closest(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect((scroller as HTMLElement).className).toMatch(/max-h-\[/);
  });
});
