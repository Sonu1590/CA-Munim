import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataExport } from "@/components/settings/DataExport";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { fetchInvoicesFromSupabase } from "@/data/Billing";
import { useTasks } from "@/hooks/useTasks";
import { downloadCsv, downloadExcelTable, downloadTextFile } from "@/lib/downloads";

vi.mock("@/data/Clients", () => ({ fetchClientsFromSupabase: vi.fn() }));
vi.mock("@/data/Billing", () => ({ fetchInvoicesFromSupabase: vi.fn() }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/lib/downloads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/downloads")>();
  return {
    ...actual,
    downloadCsv: vi.fn(),
    downloadExcelTable: vi.fn(),
    downloadTextFile: vi.fn(),
  };
});

const mockClients = vi.mocked(fetchClientsFromSupabase);
const mockInvoices = vi.mocked(fetchInvoicesFromSupabase);
const mockUseTasks = vi.mocked(useTasks);
const mockCsv = vi.mocked(downloadCsv);
const mockExcel = vi.mocked(downloadExcelTable);
const mockText = vi.mocked(downloadTextFile);

describe("DataExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTasks.mockReturnValue({ tasks: [] } as never);
    mockClients.mockResolvedValue([{ name: "Acme", servicesSubscribed: [] } as never]);
    mockInvoices.mockResolvedValue([{ invoiceNumber: "INV-1" } as never]);
  });

  it("renders the three export cards and the backup card", () => {
    render(<DataExport />);

    expect(screen.getByText("Export All Clients")).toBeInTheDocument();
    expect(screen.getByText("Export All Tasks")).toBeInTheDocument();
    expect(screen.getByText("Export All Invoices")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request Backup/ })).toBeInTheDocument();
  });

  it("exports the client master list as CSV after fetching clients", async () => {
    render(<DataExport />);

    // The clients export card's action button is labelled with its format.
    fireEvent.click(screen.getAllByRole("button", { name: "CSV" })[0]);

    await waitFor(() => expect(mockClients).toHaveBeenCalled());
    await waitFor(() => expect(mockCsv).toHaveBeenCalled());
    expect(mockCsv.mock.calls[0][0]).toBe("clients-master-list.csv");
  });

  it("exports task history as an Excel table using the hook's tasks", () => {
    mockUseTasks.mockReturnValue({ tasks: [{ clientName: "Acme", taskType: "GSTR-3B", documentChecklist: [] } as never] } as never);
    render(<DataExport />);

    fireEvent.click(screen.getByRole("button", { name: "Excel" }));

    expect(mockExcel).toHaveBeenCalled();
    expect(mockExcel.mock.calls[0][0]).toBe("task-history.xls");
  });

  it("exports the invoice register as CSV after fetching invoices", async () => {
    render(<DataExport />);

    // Second CSV button belongs to the invoices card.
    fireEvent.click(screen.getAllByRole("button", { name: "CSV" })[1]);

    await waitFor(() => expect(mockInvoices).toHaveBeenCalled());
    await waitFor(() => expect(mockCsv).toHaveBeenCalled());
    expect(mockCsv.mock.calls[0][0]).toBe("invoice-register.csv");
  });

  it("requests a full JSON backup combining clients, tasks and invoices", async () => {
    render(<DataExport />);

    fireEvent.click(screen.getByRole("button", { name: /Request Backup/ }));

    await waitFor(() => expect(mockText).toHaveBeenCalled());
    expect(mockText.mock.calls[0][0]).toBe("ca-munim-backup.json");
    expect(mockClients).toHaveBeenCalled();
    expect(mockInvoices).toHaveBeenCalled();
  });
});
