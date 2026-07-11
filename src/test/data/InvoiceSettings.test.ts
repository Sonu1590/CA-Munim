import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchInvoiceSettingsFromSupabase,
  saveInvoiceSettingsToSupabase,
  mockInvoiceSettings,
  type InvoiceSettings,
} from "@/data/Settings";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

const FIRM_ID = "firm-123";

function mockAuthenticatedFirm() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  } as never);
}

describe("Invoice settings data helpers (M13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetch selects the real column names (reset_annually/default_terms/default_notes) scoped to the firm", async () => {
    mockAuthenticatedFirm();

    const staffBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { firm_id: FIRM_ID }, error: null }),
    };
    const settingsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          prefix: "INV",
          reset_annually: false,
          default_terms: "Net 30",
          default_notes: "Real footer",
          gst_rate: 12,
          signatory_name: "Real Signatory",
          signature_url: null,
        },
        error: null,
      }),
    };

    mockSupabase.from.mockImplementation((table: string) =>
      (table === "staff" ? staffBuilder : settingsBuilder) as never
    );

    const result = await fetchInvoiceSettingsFromSupabase();

    expect(settingsBuilder.select).toHaveBeenCalledWith(expect.stringContaining("reset_annually"));
    expect(settingsBuilder.select).toHaveBeenCalledWith(expect.stringContaining("default_terms"));
    expect(settingsBuilder.select).toHaveBeenCalledWith(expect.stringContaining("default_notes"));
    expect(settingsBuilder.select).not.toHaveBeenCalledWith(expect.stringContaining("reset_per_fy"));
    expect(settingsBuilder.eq).toHaveBeenCalledWith("firm_id", FIRM_ID);
    expect(result.resetPerFY).toBe(false);
    expect(result.paymentTerms).toBe("Net 30");
    expect(result.footerNotes).toBe("Real footer");
  });

  it("returns defaults (not an error) when no row exists yet for the firm", async () => {
    mockAuthenticatedFirm();

    const staffBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { firm_id: FIRM_ID }, error: null }),
    };
    const settingsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabase.from.mockImplementation((table: string) =>
      (table === "staff" ? staffBuilder : settingsBuilder) as never
    );

    const result = await fetchInvoiceSettingsFromSupabase();

    expect(result).toEqual(mockInvoiceSettings);
  });

  it("throws (does not silently fall back) when the query actually fails", async () => {
    mockAuthenticatedFirm();

    const staffBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { firm_id: FIRM_ID }, error: null }),
    };
    const settingsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "connection reset" } }),
    };

    mockSupabase.from.mockImplementation((table: string) =>
      (table === "staff" ? staffBuilder : settingsBuilder) as never
    );

    await expect(fetchInvoiceSettingsFromSupabase()).rejects.toThrow("connection reset");
  });

  it("save upserts with firm_id set and onConflict: firm_id (not a hardcoded id: 1)", async () => {
    mockAuthenticatedFirm();

    const staffBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { firm_id: FIRM_ID }, error: null }),
    };
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const settingsBuilder = { upsert };

    mockSupabase.from.mockImplementation((table: string) =>
      (table === "staff" ? staffBuilder : settingsBuilder) as never
    );

    const settings: InvoiceSettings = {
      prefix: "INV",
      resetPerFY: true,
      paymentTerms: "Net 15",
      footerNotes: "Thanks",
      gstRate: 18,
      signatoryName: "CA Test",
    };

    await saveInvoiceSettingsToSupabase(settings);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ firm_id: FIRM_ID }),
      { onConflict: "firm_id" }
    );
    const payload = upsert.mock.calls[0][0];
    expect(payload.id).toBeUndefined();
    expect(payload.reset_annually).toBe(true);
    expect(payload.default_terms).toBe("Net 15");
    expect(payload.default_notes).toBe("Thanks");
  });
});
