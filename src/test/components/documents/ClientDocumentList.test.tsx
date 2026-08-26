import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientDocumentList } from "@/components/documents/ClientDocumentList";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { fetchDocumentsFromSupabase } from "@/data/Documents";

vi.mock("@/data/Clients", () => ({ fetchClientsFromSupabase: vi.fn() }));
vi.mock("@/data/Documents", () => ({ fetchDocumentsFromSupabase: vi.fn() }));

const mockClients = vi.mocked(fetchClientsFromSupabase);
const mockDocs = vi.mocked(fetchDocumentsFromSupabase);

function client(overrides: Record<string, unknown> = {}) {
  return { id: "c1", name: "Amit Traders", pan: "ABCDE1234F", ...overrides };
}

function buildClients(n: number) {
  return Array.from({ length: n }, (_, i) =>
    client({ id: `c-${i}`, name: `Doc Client ${String(i).padStart(3, "0")}`, pan: `PAN${i}` }),
  );
}

async function renderList(clients: unknown[], documents: unknown[] = [], onSelect = vi.fn()) {
  mockClients.mockResolvedValue(clients as never);
  mockDocs.mockResolvedValue(documents as never);
  render(<ClientDocumentList onSelectClient={onSelect} />);
  return onSelect;
}

describe("ClientDocumentList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders each client with a document count", async () => {
    await renderList(
      [client({ id: "c1", name: "Amit Traders", pan: "ABCDE1234F" })],
      [{ clientId: "c1" }, { clientId: "c1" }, { clientId: "other" }],
    );

    await waitFor(() => expect(screen.getByText("Amit Traders")).toBeInTheDocument());
    expect(screen.getByText("ABCDE1234F")).toBeInTheDocument();
    expect(screen.getByText("2 docs")).toBeInTheDocument();
  });

  it("calls onSelectClient when a client card is clicked", async () => {
    const onSelect = await renderList([client({ id: "c9", name: "Bela Co", pan: "BELAP0000B" })]);
    await waitFor(() => expect(screen.getByText("Bela Co")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Bela Co"));
    expect(onSelect).toHaveBeenCalledWith("c9");
  });

  it("shows the empty state when there are no clients", async () => {
    await renderList([], []);
    await waitFor(() => expect(screen.getByText("No clients found")).toBeInTheDocument());
  });

  it("filters clients by name via search", async () => {
    await renderList([
      client({ id: "c1", name: "Amit Traders", pan: "AAA" }),
      client({ id: "c2", name: "Bela Co", pan: "BBB" }),
    ]);
    await waitFor(() => expect(screen.getByText("Amit Traders")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Search clients by name or PAN..."), { target: { value: "Bela" } });

    await waitFor(() => expect(screen.queryByText("Amit Traders")).not.toBeInTheDocument());
    expect(screen.getByText("Bela Co")).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    mockClients.mockRejectedValue(new Error("load failed"));
    mockDocs.mockResolvedValue([] as never);
    render(<ClientDocumentList onSelectClient={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/load failed/)).toBeInTheDocument());
  });

  // M27: pair with a firm-scale list and confirm 25/page pagination.
  it("bounds a 60-client list to 25 per page", async () => {
    await renderList(buildClients(60), []);
    await waitFor(() => expect(screen.getByText("Doc Client 000")).toBeInTheDocument());

    expect(screen.getByText("Doc Client 024")).toBeInTheDocument();
    expect(screen.queryByText("Doc Client 025")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument();
  });
});
