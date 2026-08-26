import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageTemplates } from "@/components/whatsapp/MessageTemplates";
import {
  fetchMessageTemplatesFromSupabase,
  saveMessageTemplateToSupabase,
  deleteMessageTemplateFromSupabase,
  type MessageTemplate,
} from "@/data/WhatsappApi";
import { toast } from "sonner";

vi.mock("@/data/WhatsappApi", () => ({
  fetchMessageTemplatesFromSupabase: vi.fn(),
  saveMessageTemplateToSupabase: vi.fn(),
  deleteMessageTemplateFromSupabase: vi.fn(),
  defaultTemplates: [],
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.mocked(fetchMessageTemplatesFromSupabase);
const mockSave = vi.mocked(saveMessageTemplateToSupabase);
const mockDelete = vi.mocked(deleteMessageTemplateFromSupabase);
const mockToast = vi.mocked(toast, true);

function template(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: "t1",
    name: "GST Reminder",
    category: "GST",
    body: "Hello {{client_name}}, your GST is due.",
    variables: ["client_name"],
    isDefault: false,
    ...overrides,
  };
}

async function renderTemplates(rows: MessageTemplate[]) {
  mockFetch.mockResolvedValue(rows);
  render(<MessageTemplates />);
  await waitFor(() => expect(screen.getByText(rows[0].name)).toBeInTheDocument());
}

describe("MessageTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loaded templates with their category badge", async () => {
    await renderTemplates([template({ name: "GST Reminder", category: "GST" })]);
    expect(screen.getByText("GST Reminder")).toBeInTheDocument();
    expect(screen.getByText("GST")).toBeInTheDocument();
  });

  // M16: duplicating a template must PERSIST via saveMessageTemplateToSupabase,
  // not just append to local state (the old bug: the copy vanished on refresh).
  it("persists a duplicated template through saveMessageTemplateToSupabase", async () => {
    mockSave.mockResolvedValue(template({ id: "t2", name: "GST Reminder (Copy)" }));
    await renderTemplates([template({ name: "GST Reminder" })]);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate GST Reminder template" }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    // Saved with a "(Copy)" name and no id (a new row, not an update).
    expect(mockSave.mock.calls[0][0]).toMatchObject({ name: "GST Reminder (Copy)", isDefault: false });
    expect(mockSave.mock.calls[0][0]).not.toHaveProperty("id");
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Template duplicated"));
    await waitFor(() => expect(screen.getByText("GST Reminder (Copy)")).toBeInTheDocument());
  });

  it("surfaces a duplicate failure without appending a phantom copy", async () => {
    mockSave.mockRejectedValue(new Error("save blocked"));
    await renderTemplates([template({ name: "GST Reminder" })]);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate GST Reminder template" }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("save blocked"));
    expect(screen.queryByText("GST Reminder (Copy)")).not.toBeInTheDocument();
  });

  it("deletes a non-default template via deleteMessageTemplateFromSupabase", async () => {
    mockDelete.mockResolvedValue(undefined as never);
    await renderTemplates([template({ id: "t9", name: "Custom Reminder", isDefault: false })]);

    fireEvent.click(screen.getByRole("button", { name: "Delete Custom Reminder template" }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("t9"));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Template deleted"));
    await waitFor(() => expect(screen.queryByText("Custom Reminder")).not.toBeInTheDocument());
  });

  it("does not offer a delete action for a default template", async () => {
    await renderTemplates([template({ name: "Built-in Reminder", isDefault: true })]);
    expect(screen.queryByRole("button", { name: /Delete Built-in Reminder template/ })).not.toBeInTheDocument();
  });

  it("filters templates by the search box", async () => {
    await renderTemplates([
      template({ id: "t1", name: "GST Reminder", body: "gst body" }),
      template({ id: "t2", name: "ITR Reminder", body: "itr body" }),
    ]);

    fireEvent.change(screen.getByPlaceholderText("Search templates..."), { target: { value: "ITR" } });

    expect(screen.getByText("ITR Reminder")).toBeInTheDocument();
    expect(screen.queryByText("GST Reminder")).not.toBeInTheDocument();
  });
});
