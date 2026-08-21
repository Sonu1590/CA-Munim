import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePwaUsageSignal } from "@/hooks/usePwaUsageSignal";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

const mockSupabase = vi.mocked(supabase, true);

// Control the standalone-display detection: usePwaUsageSignal reads
// window.matchMedia("(display-mode: standalone)").matches.
function setDisplayMode(standalone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: standalone && query.includes("standalone"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as never;
}

describe("usePwaUsageSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);
    setDisplayMode(false);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("logs a standalone_launch event once when launched in standalone mode", async () => {
    setDisplayMode(true);

    renderHook(() => usePwaUsageSignal());

    await waitFor(() => {
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "log_pwa_usage_event",
        expect.objectContaining({ p_event_type: "standalone_launch" }),
      );
    });
  });

  it("does not log a launch event when running in a normal browser tab", async () => {
    setDisplayMode(false);

    renderHook(() => usePwaUsageSignal());

    // Give any (unexpected) async logging a chance to fire.
    await Promise.resolve();
    expect(mockSupabase.rpc).not.toHaveBeenCalledWith(
      "log_pwa_usage_event",
      expect.objectContaining({ p_event_type: "standalone_launch" }),
    );
  });

  it("logs the launch only once per browser session (sessionStorage-guarded)", async () => {
    setDisplayMode(true);

    // First mount logs and sets the session guard.
    const first = renderHook(() => usePwaUsageSignal());
    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalledTimes(1));
    first.unmount();

    // A second mount within the same session must NOT log again.
    renderHook(() => usePwaUsageSignal());
    await Promise.resolve();
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("ca-munim-pwa-launch-logged")).toBe("1");
  });

  it("logs prompt_shown / installed when the corresponding window events fire", async () => {
    setDisplayMode(false);

    renderHook(() => usePwaUsageSignal());

    window.dispatchEvent(new Event("beforeinstallprompt"));
    window.dispatchEvent(new Event("appinstalled"));

    await waitFor(() => {
      const types = mockSupabase.rpc.mock.calls.map((c) => (c[1] as { p_event_type: string }).p_event_type);
      expect(types).toContain("prompt_shown");
      expect(types).toContain("installed");
    });
  });

  it("removes its window listeners on unmount", async () => {
    setDisplayMode(false);
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => usePwaUsageSignal());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("beforeinstallprompt", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("swallows an RPC failure and never throws (best-effort telemetry)", async () => {
    setDisplayMode(true);
    mockSupabase.rpc.mockRejectedValue(new Error("rpc unavailable"));

    // Rendering must not throw despite the rejected telemetry write.
    expect(() => renderHook(() => usePwaUsageSignal())).not.toThrow();

    // The event handlers also swallow rejections without surfacing them.
    renderHook(() => usePwaUsageSignal());
    window.dispatchEvent(new Event("appinstalled"));
    await Promise.resolve();
    // No assertion on rpc result — the point is that nothing above threw.
    expect(mockSupabase.rpc).toHaveBeenCalled();
  });
});
