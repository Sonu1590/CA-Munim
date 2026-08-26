import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirmProfileSettings } from "@/components/settings/FirmProfileSettings";
import { fetchFirmProfileFromSupabase, saveFirmProfileToSupabase, type FirmProfile } from "@/data/Settings";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

vi.mock("@/data/Settings", () => ({
  fetchFirmProfileFromSupabase: vi.fn(),
  saveFirmProfileToSupabase: vi.fn(),
}));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.mocked(fetchFirmProfileFromSupabase);
const mockSave = vi.mocked(saveFirmProfileToSupabase);
const mockRole = vi.mocked(useUserRole);
const mockToast = vi.mocked(toast, true);

function profile(overrides: Partial<FirmProfile> = {}): FirmProfile {
  return {
    firmName: "Sharma & Associates",
    caName: "R Sharma",
    icaiMembershipNo: "123456",
    address: "12 MG Road",
    city: "Mumbai",
    state: "Maharashtra",
    pinCode: "400001",
    phone: "9876543210",
    email: "firm@example.com",
    firmPan: "ABCDE1234F",
    bankName: "HDFC",
    accountName: "Sharma Assoc Current A/C",
    accountNumber: "000111222",
    ifscCode: "HDFC0000001",
    branchName: "Fort",
    ...overrides,
  };
}

async function renderProfile(isAdmin = true, p = profile()) {
  mockRole.mockReturnValue({ role: isAdmin ? "admin" : "staff", isAdmin, loading: false });
  mockFetch.mockResolvedValue(p);
  render(<FirmProfileSettings />);
  await waitFor(() => expect(screen.getByDisplayValue("Sharma & Associates")).toBeInTheDocument());
}

describe("FirmProfileSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loaded profile into the form fields", async () => {
    await renderProfile();

    expect(screen.getByDisplayValue("R Sharma")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ABCDE1234F")).toBeInTheDocument();
    expect(screen.getByDisplayValue("firm@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("HDFC0000001")).toBeInTheDocument();
  });

  it("saves the profile via saveFirmProfileToSupabase for an admin", async () => {
    mockSave.mockResolvedValue(undefined as never);
    await renderProfile(true);

    fireEvent.click(screen.getByRole("button", { name: /Save Firm Profile/ }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0]).toMatchObject({ firmName: "Sharma & Associates" });
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Firm profile updated successfully"));
  });

  it("reflects an edited field in the payload passed to save", async () => {
    mockSave.mockResolvedValue(undefined as never);
    await renderProfile(true);

    fireEvent.change(screen.getByDisplayValue("R Sharma"), { target: { value: "R Sharma Jr" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Firm Profile/ }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0]).toMatchObject({ caName: "R Sharma Jr" });
  });

  it("disables saving and explains the restriction for a non-admin", async () => {
    await renderProfile(false);

    expect(screen.getByText("Only firm admins can edit the firm profile.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Firm Profile/ })).toBeDisabled();
  });

  it("surfaces a save failure via an error toast", async () => {
    mockSave.mockRejectedValue(new Error("update rejected"));
    await renderProfile(true);

    fireEvent.click(screen.getByRole("button", { name: /Save Firm Profile/ }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("update rejected"));
  });

  it("shows an error state when the profile fails to load", async () => {
    mockRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockFetch.mockRejectedValue(new Error("cannot load firm"));
    render(<FirmProfileSettings />);

    await waitFor(() => expect(screen.getByText("cannot load firm")).toBeInTheDocument());
  });
});
