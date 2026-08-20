import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

function mockUser(user: { id: string } | null) {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null } as never);
}

function mockStaffRole(result: { data: unknown; error?: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: result.data, error: result.error ?? null }),
  };
  mockSupabase.from.mockReturnValue(builder as never);
  return builder;
}

describe("useUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in a loading state with no role", async () => {
    mockUser({ id: "user-1" });
    mockStaffRole({ data: { role: "admin" } });

    const { result } = renderHook(() => useUserRole());

    expect(result.current.loading).toBe(true);
    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);

    // Flush the pending async resolution so it doesn't fire outside act().
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("resolves an admin role and sets isAdmin", async () => {
    mockUser({ id: "user-1" });
    const builder = mockStaffRole({ data: { role: "admin" } });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe("admin");
    expect(result.current.isAdmin).toBe(true);
    expect(builder.eq).toHaveBeenCalledWith("auth_user_id", "user-1");
  });

  it("treats any non-admin role value as plain staff", async () => {
    mockUser({ id: "user-2" });
    mockStaffRole({ data: { role: "staff" } });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe("staff");
    expect(result.current.isAdmin).toBe(false);
  });

  it("defaults to staff (not admin) when the staff row is missing", async () => {
    mockUser({ id: "user-3" });
    mockStaffRole({ data: null });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Fail closed: absence of a role never grants admin.
    expect(result.current.role).toBe("staff");
    expect(result.current.isAdmin).toBe(false);
  });

  it("leaves role null and stops loading when there is no authenticated user", async () => {
    mockUser(null);

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    // Never queried the staff table without a user.
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
