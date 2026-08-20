import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaff } from "@/hooks/useStaff";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

// useStaff fetches active staff via .select().eq().order(); order resolves.
function mockStaffQuery(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  };
  mockSupabase.from.mockReturnValue(builder as never);
  return builder;
}

describe("useStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads active staff ordered by name", async () => {
    const rows = [
      { id: "s1", name: "Priya Verma", email: "priya@example.com", role: "admin" },
      { id: "s2", name: "Rahul Nair", email: "rahul@example.com", role: "staff" },
    ];
    const builder = mockStaffQuery({ data: rows, error: null });

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockSupabase.from).toHaveBeenCalledWith("staff");
    expect(builder.eq).toHaveBeenCalledWith("active", true);
    expect(builder.order).toHaveBeenCalledWith("name");
    expect(result.current.staff).toEqual(rows);
  });

  it("leaves staff empty and stops loading on query error (does not throw)", async () => {
    mockStaffQuery({ data: null, error: { message: "permission denied" } });

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.staff).toEqual([]);
  });

  it("coerces a null data payload to an empty array", async () => {
    mockStaffQuery({ data: null, error: null });

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.staff).toEqual([]);
  });
});
