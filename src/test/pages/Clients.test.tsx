import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/components/clients/ClientCards", () => ({
  ClientCards: ({ clients }: { clients: any[] }) => (
    <div data-testid="client-cards">Mobile cards: {clients.length}</div>
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

function mockClientsState(overrides: Partial<ReturnType<typeof useClients>> = {}) {
  const state = {
    clients,
    loading: false,
    error: null,
    addClient: vi.fn().mockResolvedValue(true),
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

    render(<Clients />);

    expect(screen.getByText("Loading clients...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Clients" })).not.toBeInTheDocument();
  });

  it("shows an error state and retries through refetch", () => {
    const refetch = vi.fn();
    mockClientsState({ clients: [], error: "Unable to load clients", refetch });

    render(<Clients />);

    expect(screen.getByText("Unable to load clients")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders empty state and opens the add-client modal", () => {
    mockClientsState({ clients: [] });

    render(<Clients />);

    expect(screen.getByText("No clients added yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add First Client/i }));
    expect(screen.getByRole("dialog", { name: "Add New Client" })).toBeInTheDocument();
  });

  it("renders clients with Indian-grouped fees and filters by search text", () => {
    mockClientsState();

    render(<Clients />);

    expect(screen.getByRole("heading", { name: "Clients" })).toBeInTheDocument();
    expect(screen.getByText("Mock Client Pvt Ltd")).toBeInTheDocument();
    expect(screen.getByText("Asha Sharma")).toBeInTheDocument();
    expect(screen.getByText("1,25,000")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by name, PAN, or phone..."), {
      target: { value: "PQRSX" },
    });

    expect(screen.queryByText("Mock Client Pvt Ltd")).not.toBeInTheDocument();
    expect(screen.getByText("Asha Sharma")).toBeInTheDocument();
  });

  it("passes saved client data to addClient and closes the modal on success", async () => {
    const addClient = vi.fn().mockResolvedValue(true);
    mockClientsState({ addClient });

    render(<Clients />);

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
