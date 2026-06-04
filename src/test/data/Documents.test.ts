import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDocumentRequestsFromSupabase } from "@/data/Documents";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

describe("Documents data helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads document requests with client name join and resolves snake_case document types", async () => {
    const rows = [
      {
        id: "req-1",
        client_id: "client-1",
        clients: { name: "Amit Sharma" },
        document_type: "bank_statement",
        custom_label: null,
        due_date: "2026-06-10",
        status: "pending",
        created_at: "2026-06-01T00:00:00Z",
      },
    ];

    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => ({ data: rows, error: null })),
    };

    mockSupabase.from.mockReturnValue(builder as never);

    const result = await fetchDocumentRequestsFromSupabase();

    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("clients(name)"));
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result[0].clientName).toBe("Amit Sharma");
    expect(result[0].documentType).toBe("Bank Statement");
  });
});
