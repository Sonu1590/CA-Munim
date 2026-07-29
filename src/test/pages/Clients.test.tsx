import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Clients from "@/pages/Clients";
import { useClients } from "@/hooks/useClients";

vi.mock("@/hooks/useClients", () => ({
  useClients: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock("@/components/clients/ClientListTable", () => ({
  ClientListTable: ({ clients, onEdit }: { clients: any[]; onEdit: (client: any) => void }) => (
    <div data-testid="client-list-table">
      {clients.map((client) => (
        <div key={client.id}>
          <span>{client.name}</span>
          <span>{client.pan}</span>
          <span>{client.pendingFees.toLocaleString("en-IN")}</span>
          <button type="button" onClick={() => onEdit(client)}>
            Edit {client.name}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/clients/AddClientModal", () => ({
  AddClientModal: ({
    open,
    onOpenChange,
    onSave,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave?: (formData: any) => Promise<void>;
  }) =>
    open ? (
      <div role="dialog" aria-label="Add New Client">
        <button type="button" onClick={() => onOpenChange(false)}>
          Close modal
        </button>
        <button
          type="button"
          onClick={() =>
            onSave?.({
              name: "New Client",
              type: "Individual",
              pan: "ABCDE1234F",
              phone: "9999999999",
              email: "new@example.com",
              city: "Mumbai",
              state: "Maharashtra",
            })
          }
        >
          Save mock client
        </button>
      </div>
    ) : null,
}));

const mockUseClients = vi.mocked(useClients);

const clients = [
  {
    id: "client-1",
    name: "Mock Client Pvt Ltd",
    type: "Private Ltd",
    pan: "ABCDE1234F",
    phone: "9876543210",
    email: "mock@example.com",
    activeTasks: 2,
    pendingFees: 125000,
    feesOverdue: true,
    lastActivity: "2026-05-09",
    city: "Mumbai",
    state: "Maharashtra",
    servicesSubscribed: ["GST Returns"],
  },
  {
    id: "client-2",
    name: "Asha Sharma",
    type: "Individual",
    pan: "PQRSX9876A",
    phone: "9123456780",
    email: "asha@example.com",
    activeTasks: 0,
    pendingFees: 5000,
    feesOverdue: false,
    lastActivity: "2026-05-10",
    city: "Pune",
    state: "Maharashtra",
    servicesSubscribed: ["ITR Filing"],
  },
];

// M27, ISSUES.md — same "fixed object + overrides, generalized to also
// take a count" convention as fixtures/dashboard.ts's buildDigestItems.
function buildClients(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `bulk-client-${i}`,
    name: `Bulk Client ${String(i).padStart(3, "0")}`,
    type: "Individual",
    pan: `BULKP${i}234F`,
    phone: `90000${String(i).padStart(5, "0")}`,
    email: `bulk${i}@example.com`,
    activeTasks: 0,
    pendingFees: 0,
    feesOverdue: false,
    lastActivity: "2026-05-09",
    city: "Mumbai",
    state: "Maharashtra",
    servicesSubscribed: [],
  }));
}

function mockClientsState(overrides: Partial<ReturnType<typeof useClients>> = {}) {
  const state = {
    clients,
    loading: false,
    error: null,
    addClient: vi.fn().mockResolvedValue({ success: true }),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
  mockUseClients.mockReturnValue(state as ReturnType<typeof useClients>);
  return state;
}

describe("Clients page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while clients are loading", () => {
    mockClientsState({ clients: [], loading: true });

    render(<MemoryRouter><Clients /></MemoryRouter>);

    expect(screen.getByText("Loading clients...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Clients" })).not.toBeInTheDocument();
  });

  it("shows an error state and retries through refetch", () => {
    const refetch = vi.fn();
    mockClientsState({ clients: [], error: "Unable to load clients", refetch });

    render(<MemoryRouter><Clients /></MemoryRouter>);

    expect(screen.getByText("Unable to load clients")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders empty state and opens the add-client modal", () => {
    mockClientsState({ clients: [] });

    render(<MemoryRouter><Clients /></MemoryRouter>);

    expect(screen.getByText("No clients added yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add First Client/i }));
    expect(screen.getByRole("dialog", { name: "Add New Client" })).toBeInTheDocument();
  });

  it("renders clients with Indian-grouped fees and filters by search text", () => {
    mockClientsState();

    render(<MemoryRouter><Clients /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Clients" })).toBeInTheDocument();

    const desktop = within(screen.getByTestId("desktop-clients"));
    expect(desktop.getByText("Mock Client Pvt Ltd")).toBeInTheDocument();
    expect(desktop.getByText("Asha Sharma")).toBeInTheDocument();
    expect(desktop.getByText("1,25,000")).toBeInTheDocument();

    // Mobile Clients tree renders the same real, unmocked data.
    const mobile = within(screen.getByTestId("mobile-clients"));
    expect(mobile.getByText("Mock Client Pvt Ltd")).toBeInTheDocument();
    expect(mobile.getByText("Asha Sharma")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by name, PAN, or phone..."), {
      target: { value: "PQRSX" },
    });

    expect(desktop.queryByText("Mock Client Pvt Ltd")).not.toBeInTheDocument();
    expect(desktop.getByText("Asha Sharma")).toBeInTheDocument();
    expect(mobile.queryByText("Mock Client Pvt Ltd")).not.toBeInTheDocument();
    expect(mobile.getByText("Asha Sharma")).toBeInTheDocument();
  });

  it("bounds a firm-scale (60 client) list to one page of 25 with working pagination", () => {
    mockClientsState({ clients: buildClients(60) });

    render(<MemoryRouter><Clients /></MemoryRouter>);

    const desktop = within(screen.getByTestId("desktop-clients"));
    expect(desktop.getByText("Bulk Client 000")).toBeInTheDocument();
    expect(desktop.getByText("Bulk Client 024")).toBeInTheDocument();
    expect(desktop.queryByText("Bulk Client 025")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(desktop.queryByText("Bulk Client 000")).not.toBeInTheDocument();
    expect(desktop.getByText("Bulk Client 025")).toBeInTheDocument();
    expect(desktop.getByText("Bulk Client 049")).toBeInTheDocument();
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
  });

  it("passes saved client data to addClient and closes the modal on success", async () => {
    const addClient = vi.fn().mockResolvedValue({ success: true });
    mockClientsState({ addClient });

    render(<MemoryRouter><Clients /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Add Client/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save mock client" }));

    expect(addClient).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Client",
        pan: "ABCDE1234F",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Clients" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add New Client" })).not.toBeInTheDocument();
  });
});
