import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentRequestModal } from "@/components/documents/DocumentRequestModal";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { sendQuickReminder } from "@/data/WhatsappApi";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FinancialYearProvider } from "@/context/financialYear";

vi.mock("@/data/Clients", () => ({ fetchClientsFromSupabase: vi.fn() }));
vi.mock("@/data/WhatsappApi", () => ({ sendQuickReminder: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockClients = vi.mocked(fetchClientsFromSupabase);
const mockSend = vi.mocked(sendQuickReminder);
const mockSupabase = vi.mocked(supabase, true);
const mockToast = vi.mocked(toast, true);

const insert = vi.fn();

function primeBackend(insertResult: { error: unknown } = { error: null }) {
  mockClients.mockResolvedValue([{ id: "c1", name: "Amit Traders", phone: "919876543210" } as never]);
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null } as never);
  insert.mockResolvedValue(insertResult);
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "staff") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { firm_id: "firm-1" }, error: null }),
      } as never;
    }
    return { insert } as never; // document_requests
  });
}

function renderModal() {
  return render(
    <FinancialYearProvider>
      <DocumentRequestModal open onOpenChange={vi.fn()} preselectedClientId="c1" />
    </FinancialYearProvider>,
  );
}

// Fill the Radix docType Select and the native date input so the Send handler
// passes validation.
async function fillForm() {
  // Wait for the client list to load (the preselected client resolves).
  await waitFor(() => expect(mockClients).toHaveBeenCalled());

  const comboboxes = screen.getAllByRole("combobox");
  // [0] = Client, [1] = Document Type.
  fireEvent.click(comboboxes[1]);
  fireEvent.click(await screen.findByText("Bank Statement"));

  const dateInput = document.getElementById("documentDueDate") as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: "2026-06-30" } });
}

describe("DocumentRequestModal", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => {};
    if (!globalThis.crypto?.getRandomValues) {
      // @ts-expect-error minimal polyfill for the token generator
      globalThis.crypto = { getRandomValues: (a: Uint8Array) => a };
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // navigator.clipboard is used on the send-failure path.
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("rejects an empty form without calling the send path", async () => {
    mockClients.mockResolvedValue([]);
    render(
      <FinancialYearProvider>
        <DocumentRequestModal open onOpenChange={vi.fn()} />
      </FinancialYearProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Send Request/ }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Please fill all required fields"));
    expect(mockSend).not.toHaveBeenCalled();
  });

  // M23: "Send Request" inserts the request, THEN calls the real WhatsApp send.
  it("inserts the request and then sends the real WhatsApp reminder", async () => {
    primeBackend({ error: null });
    mockSend.mockResolvedValue(undefined as never);
    renderModal();

    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Send Request/ }));

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    // Sent for the selected client with the docs template + upload link override.
    expect(mockSend.mock.calls[0][0]).toMatchObject({ id: "c1", name: "Amit Traders", phone: "919876543210" });
    expect(mockSend.mock.calls[0][1]).toBe("Documents Pending");
    expect(mockSend.mock.calls[0][3]).toMatchObject({ doc_name: "Bank Statement" });
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Document request sent!", expect.anything()));
  });

  // M23: a send failure must NOT claim success or roll back the created request
  // — it surfaces the error and copies the link as a manual fallback.
  it("surfaces a send failure honestly while keeping the created request", async () => {
    primeBackend({ error: null });
    mockSend.mockRejectedValue(new Error("no phone on file"));
    renderModal();

    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Send Request/ }));

    // The DB insert still happened (request was created)...
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    // ...but the WhatsApp failure is reported, not a fake success.
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("no phone on file", expect.anything()));
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("aborts before sending when the request insert fails", async () => {
    primeBackend({ error: new Error("insert rejected") });
    renderModal();

    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Send Request/ }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("insert rejected"));
    // The send path is never reached when the request itself couldn't be saved.
    expect(mockSend).not.toHaveBeenCalled();
  });
});
