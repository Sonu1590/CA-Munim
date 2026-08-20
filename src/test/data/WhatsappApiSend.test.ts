import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendQuickReminder } from "@/data/WhatsappApi";
import { fetchFirmProfileFromSupabase } from "@/data/Settings";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

// fetchMessageTemplatesFromSupabase + sendBulkWhatsAppMessages are same-module
// and run for real (driven via the supabase mock); only the cross-module firm
// lookup is stubbed here.
vi.mock("@/data/Settings", () => ({
  fetchFirmProfileFromSupabase: vi.fn(),
}));

const mockSupabase = vi.mocked(supabase, true);
const mockFetchFirm = vi.mocked(fetchFirmProfileFromSupabase);

const client = { id: "client-1", name: "Amit Sharma", phone: "919876543210", pendingFees: 5000, servicesSubscribed: ["GST Returns"] };

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tpl-1",
    name: "Deadline Reminder",
    category: "General",
    body: "Hello {{client_name}}, regards {{firm_name}}",
    variables: ["client_name", "firm_name"],
    is_default: false,
    ...overrides,
  };
}

// Configure the template fetch, the edge-function result, and the log insert.
function setup(opts: {
  templates?: unknown[];
  edgeResult?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
  user?: { id: string } | null;
} = {}) {
  const {
    templates = [templateRow()],
    edgeResult = { data: { success: true, results: [{ phone: client.phone, success: true, wamid: "wamid-1" }] }, error: null },
    insertResult = { error: null },
    user = { id: "user-1" },
  } = opts;

  mockSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null } as never);
  mockSupabase.functions.invoke.mockResolvedValue(edgeResult as never);

  const insert = vi.fn().mockResolvedValue(insertResult);
  const templatesBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: templates, error: null }),
  };
  const sentBuilder = { insert };

  mockSupabase.from.mockImplementation((table: string) =>
    (table === "message_templates" ? templatesBuilder : sentBuilder) as never,
  );

  return { insert };
}

describe("sendQuickReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchFirm.mockResolvedValue({ firmName: "Verma & Co", caName: "CA Verma", phone: "912200000000" } as never);
  });

  it("compiles the matched template with the firm profile and dispatches via the edge function", async () => {
    const { insert } = setup();

    await expect(sendQuickReminder(client, "reminder", "FY 2025-26")).resolves.toBeUndefined();

    // Meta template name is derived as lowercase snake_case from the display name.
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      "send-whatsapp",
      expect.objectContaining({
        body: expect.objectContaining({
          templateName: "deadline_reminder",
          recipients: [
            expect.objectContaining({ phone: client.phone, parameters: ["Amit Sharma", "Verma & Co"] }),
          ],
        }),
      }),
    );
    // The logged message is the fully compiled text, incl. the firm name.
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        client_id: "client-1",
        message: "Hello Amit Sharma, regards Verma & Co",
        status: "sent",
      }),
    ]);
  });

  it("throws a clear error (no silent no-op) when the client has no phone", async () => {
    setup();
    await expect(sendQuickReminder({ ...client, phone: "" }, "reminder", "FY 2025-26")).rejects.toThrow(
      /no phone number/i,
    );
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("throws when no template name matches, rather than sending placeholder text", async () => {
    setup({ templates: [templateRow({ name: "Payment Received" })] });
    await expect(sendQuickReminder(client, "reminder", "FY 2025-26")).rejects.toThrow(
      /No "reminder" template found/i,
    );
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("surfaces a per-recipient Meta failure honestly instead of a fake success", async () => {
    setup({
      edgeResult: {
        data: { success: false, results: [{ phone: client.phone, success: false, error: "invalid recipient" }] },
        error: null,
      },
    });
    await expect(sendQuickReminder(client, "reminder", "FY 2025-26")).rejects.toThrow(/invalid recipient/i);
  });

  it("still compiles correctly when the firm profile lookup fails (falls back to generic firm name)", async () => {
    mockFetchFirm.mockRejectedValue(new Error("firm profile unavailable"));
    const { insert } = setup();

    await expect(sendQuickReminder(client, "reminder", "FY 2025-26")).resolves.toBeUndefined();

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ message: "Hello Amit Sharma, regards Your CA Firm" }),
    ]);
  });
});
