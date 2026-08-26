import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppConfig } from "@/components/settings/WhatsAppConfig";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The mobile tree renders the same preferences UI; stub it to avoid duplicates.
vi.mock("@/components/mobile/MobileNotificationSettingsScreen", () => ({
  MobileNotificationSettingsScreen: () => null,
}));

const mockSupabase = vi.mocked(supabase, true);
const mockToast = vi.mocked(toast, true);

// The load-preferences effect walks auth.getUser -> staff -> firms; keep it a
// no-op resolve so the component finishes loading with defaults.
function primeLoad() {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null } as never);
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { firm_id: "firm-1" }, error: null }),
  };
  mockSupabase.from.mockReturnValue(builder as never);
}

async function renderConfig() {
  primeLoad();
  render(<WhatsAppConfig />);
  return within(await screen.findByTestId("desktop-whatsapp-config"));
}

describe("WhatsAppConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // M16 follow-up: "Test Connection" must invoke the real edge function, not
  // fire an unconditional success toast against nothing.
  it("invokes the real whatsapp-test-connection edge function when clicked", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { connected: true, displayPhoneNumber: "+91 99999 00000" },
      error: null,
    } as never);
    const desktop = await renderConfig();

    fireEvent.click(desktop.getByRole("button", { name: /Test Connection/ }));

    await waitFor(() =>
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("whatsapp-test-connection"),
    );
    // Success is reported only after a real connected:true response.
    await waitFor(() => expect(desktop.getByText(/Connected —/)).toBeInTheDocument());
    expect(mockToast.success).toHaveBeenCalled();
  });

  it("surfaces a failure honestly when the edge function reports not-connected", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { connected: false, error: "Invalid access token" },
      error: null,
    } as never);
    const desktop = await renderConfig();

    fireEvent.click(desktop.getByRole("button", { name: /Test Connection/ }));

    await waitFor(() => expect(desktop.getByText("Invalid access token")).toBeInTheDocument());
    expect(mockToast.error).toHaveBeenCalledWith("Invalid access token");
    // It did NOT claim success.
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("surfaces a thrown edge-function error without claiming success", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: new Error("network down") } as never);
    const desktop = await renderConfig();

    fireEvent.click(desktop.getByRole("button", { name: /Test Connection/ }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("renders the four notification-preference toggles", async () => {
    const desktop = await renderConfig();

    expect(desktop.getByText("Deadline Reminders")).toBeInTheDocument();
    expect(desktop.getByText("Document Received Alerts")).toBeInTheDocument();
    expect(desktop.getByText("Payment Received Alerts")).toBeInTheDocument();
    expect(desktop.getByText("Task Assigned Alerts")).toBeInTheDocument();
    // 4 preference switches (reminder-lead-time is a number input, not a switch).
    expect(desktop.getAllByRole("switch")).toHaveLength(4);
  });

  it("toggles a notification preference switch on click", async () => {
    const desktop = await renderConfig();

    // Payment Received Alerts defaults to off.
    const switches = desktop.getAllByRole("switch");
    const paymentSwitch = switches[2];
    expect(paymentSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(paymentSwitch);
    await waitFor(() => expect(paymentSwitch).toHaveAttribute("aria-checked", "true"));
  });

  it("saves settings via the firms update path", async () => {
    const desktop = await renderConfig();
    // After load, wire the save chain: staff lookup then firms update.
    const staffBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { firm_id: "firm-1" }, error: null }),
    };
    const firmsUpdate = { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
    mockSupabase.from.mockImplementation((table: string) => (table === "staff" ? staffBuilder : firmsUpdate) as never);

    fireEvent.click(desktop.getByRole("button", { name: /Save WhatsApp Settings/ }));

    await waitFor(() => expect(firmsUpdate.update).toHaveBeenCalled());
    expect(firmsUpdate.update.mock.calls[0][0]).toHaveProperty("whatsapp_config");
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("WhatsApp settings saved successfully"));
  });
});
