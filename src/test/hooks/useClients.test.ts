import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClients, type ClientFormData } from "@/hooks/useClients";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase, true);

const FIRM_ID = "firm-1";

function fetchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    name: "Existing Client",
    client_type: "Individual",
    pan: "ZZZPZ9999Z",
    phone: "9876543210",
    email: "existing@example.com",
    date_of_birth: "1990-01-01",
    city: "Mumbai",
    state: "Maharashtra",
    services_subscribed: [],
    updated_at: "2026-05-09T10:00:00Z",
    tasks: [],
    invoices: [],
    ...overrides,
  };
}

const validForm: ClientFormData = {
  name: "New Client",
  type: "Individual",
  pan: "ABCDE1234F",
  phone: "9999999999",
  email: "new@example.com",
  date_of_birth: "1985-06-15",
  city: "Pune",
  state: "Maharashtra",
  services_subscribed: [],
};

// One flexible builder per table. The clients builder serves the fetch chain
// (select->limit->limit->eq->order) plus insert and update->eq; the staff
// builder serves select->eq->maybeSingle. Mutation error paths are configured
// per test by overriding the relevant terminal resolver.
function setupSupabase(opts: {
  fetchResult?: { data: unknown; error: unknown };
  staffResult?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
  updateResult?: { error: unknown };
  user?: { id: string } | null;
} = {}) {
  const {
    fetchResult = { data: [fetchRow()], error: null },
    staffResult = { data: { firm_id: FIRM_ID }, error: null },
    insertResult = { error: null },
    updateResult = { error: null },
    user = { id: "user-1" },
  } = opts;

  mockSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null } as never);

  const clientsBuilder = {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(fetchResult),
    insert: vi.fn().mockResolvedValue(insertResult),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(updateResult) }),
  };
  const staffBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(staffResult),
  };

  mockSupabase.from.mockImplementation((table: string) =>
    (table === "staff" ? staffBuilder : clientsBuilder) as never,
  );

  return { clientsBuilder, staffBuilder };
}

async function mountClients() {
  const view = renderHook(() => useClients());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("useClients mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addClient", () => {
    it("returns { success: true } as an OBJECT (not the boolean true) on success", async () => {
      const { clientsBuilder } = setupSupabase();
      const { result } = await mountClients();

      let res: unknown;
      await act(async () => {
        res = await result.current.addClient(validForm);
      });

      expect(res).toEqual({ success: true });
      // Bug-class (CLAUDE.md M1): callers must read `.success`. A `=== true`
      // check against this object always takes the wrong branch.
      expect(res === true).toBe(false);
      expect((res as { success: boolean }).success).toBe(true);
      expect(clientsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ firm_id: FIRM_ID, name: "New Client", pan: "ABCDE1234F" }),
      );
    });

    it("returns { success: false, error } WITHOUT throwing when the insert fails", async () => {
      // supabase's PostgrestError extends Error, so mirror that (the message
      // mapping keys off `err instanceof Error`).
      setupSupabase({ insertResult: { error: new Error("permission denied for table clients") } });
      const { result } = await mountClients();

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        // Must resolve, never reject — the whole point of the result object.
        res = await result.current.addClient(validForm);
      });

      expect(res?.success).toBe(false);
      expect(res?.error).toMatch(/do not have permission/i);
      // `=== false` against the object is likewise always wrong.
      expect((res as unknown) === false).toBe(false);
    });

    it("rejects a missing date of birth with a mapped error, not a throw", async () => {
      setupSupabase();
      const { result } = await mountClients();

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.addClient({ ...validForm, date_of_birth: "  " });
      });

      expect(res?.success).toBe(false);
      expect(res?.error).toBe("Date of Birth / Incorporation is required.");
    });

    it("rejects a duplicate PAN in-memory before hitting the DB", async () => {
      // Seed the list with a client whose PAN collides with the new one.
      const { clientsBuilder } = setupSupabase({
        fetchResult: { data: [fetchRow({ pan: "ABCDE1234F" })], error: null },
      });
      const { result } = await mountClients();

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.addClient(validForm);
      });

      expect(res).toEqual({ success: false, error: "A client with this PAN already exists." });
      // Short-circuited before the insert round-trip.
      expect(clientsBuilder.insert).not.toHaveBeenCalled();
    });

    it("maps a 'not authenticated' failure to a friendly re-sign-in message", async () => {
      setupSupabase({ user: null });
      const { result } = await mountClients();

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.addClient(validForm);
      });

      expect(res?.success).toBe(false);
      expect(res?.error).toBe("Please sign in again before saving the client.");
    });
  });

  describe("updateClient", () => {
    it("returns { success: true } (object) after a successful update", async () => {
      const { clientsBuilder } = setupSupabase();
      const { result } = await mountClients();

      let res: unknown;
      await act(async () => {
        res = await result.current.updateClient("client-1", { name: "Renamed" });
      });

      expect(res).toEqual({ success: true });
      expect(res === true).toBe(false);
      expect(clientsBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Renamed" }),
      );
    });

    it("returns a not-found result object when the id is not in the current list", async () => {
      const { clientsBuilder } = setupSupabase();
      const { result } = await mountClients();

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.updateClient("does-not-exist", { name: "X" });
      });

      expect(res?.success).toBe(false);
      expect(res?.error).toMatch(/could not be found/i);
      expect(clientsBuilder.update).not.toHaveBeenCalled();
    });

    it("returns { success: false, error } WITHOUT throwing when the update fails", async () => {
      setupSupabase({ updateResult: { error: new Error("duplicate key value violates unique constraint") } });
      const { result } = await mountClients();

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.updateClient("client-1", { name: "Renamed" });
      });

      expect(res?.success).toBe(false);
      expect(res?.error).toBe("A client with these details already exists.");
    });
  });

  describe("deleteClient", () => {
    // deleteClient is the one client mutation that returns a plain boolean.
    it("returns true (boolean) on a successful soft delete", async () => {
      setupSupabase();
      const { result } = await mountClients();

      let res: unknown;
      await act(async () => {
        res = await result.current.deleteClient("client-1");
      });

      expect(res).toBe(true);
    });

    it("returns false (not an object, not a throw) when the delete fails", async () => {
      const { clientsBuilder } = setupSupabase();
      clientsBuilder.update.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: { message: "rls denied" } }),
      });
      const { result } = await mountClients();

      let res: unknown;
      await act(async () => {
        res = await result.current.deleteClient("client-1");
      });

      expect(res).toBe(false);
    });
  });
});
