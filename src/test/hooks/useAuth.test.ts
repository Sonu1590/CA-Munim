import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

const mockSupabase = vi.mocked(supabase, true);

const unsubscribe = vi.fn();

function primeAuth(session: unknown = null) {
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null } as never);
  mockSupabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe } },
  } as never);
}

async function mountAuth() {
  const view = renderHook(() => useAuth());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates from the initial session and reports authenticated state", async () => {
    const session = { user: { id: "user-1", email: "ca@example.com" } };
    primeAuth(session);

    const { result } = await mountAuth();

    expect(result.current.user).toEqual(session.user);
    expect(result.current.session).toEqual(session);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("reports unauthenticated when there is no initial session", async () => {
    primeAuth(null);

    const { result } = await mountAuth();

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("updates state when onAuthStateChange fires with a new session", async () => {
    primeAuth(null);
    const { result } = await mountAuth();
    expect(result.current.isAuthenticated).toBe(false);

    // Invoke the registered listener as Supabase would on sign-in.
    const listener = mockSupabase.auth.onAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void;
    const newSession = { user: { id: "user-2" } };
    await waitFor(() => {
      listener("SIGNED_IN", newSession);
      expect(result.current.user).toEqual(newSession.user);
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("unsubscribes from auth changes on unmount", async () => {
    primeAuth(null);
    const { unmount } = await mountAuth();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  describe("signIn", () => {
    it("delegates to signInWithPassword and passes through the result", async () => {
      primeAuth(null);
      const payload = { data: { user: { id: "u" } }, error: null };
      mockSupabase.auth.signInWithPassword.mockResolvedValue(payload as never);
      const { result } = await mountAuth();

      const res = await result.current.signIn("ca@example.com", "secret");

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "ca@example.com",
        password: "secret",
      });
      expect(res).toEqual(payload);
    });

    it("surfaces the error object (does not throw) on bad credentials", async () => {
      primeAuth(null);
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      } as never);
      const { result } = await mountAuth();

      const res = await result.current.signIn("ca@example.com", "wrong");

      expect(res.error).toEqual({ message: "Invalid login credentials" });
    });
  });

  describe("signInWithGoogle", () => {
    it("requests the Google OAuth provider with an origin redirect", async () => {
      primeAuth(null);
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null } as never);
      const { result } = await mountAuth();

      await result.current.signInWithGoogle();

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          options: expect.objectContaining({ redirectTo: expect.stringContaining("http") }),
        }),
      );
    });
  });

  describe("signOut", () => {
    it("delegates to supabase signOut and returns the error slot", async () => {
      primeAuth(null);
      mockSupabase.auth.signOut.mockResolvedValue({ error: null } as never);
      const { result } = await mountAuth();

      const res = await result.current.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ error: null });
    });
  });

  describe("resetPassword", () => {
    it("sends a reset email with the reset-password redirect", async () => {
      primeAuth(null);
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);
      const { result } = await mountAuth();

      await result.current.resetPassword("ca@example.com");

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "ca@example.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") }),
      );
    });
  });
});
