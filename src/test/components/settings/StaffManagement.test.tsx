import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaffManagement } from "@/components/settings/StaffManagement";
import { fetchStaffFromSupabase, type StaffMember } from "@/data/Settings";
import { useUserRole } from "@/hooks/useUserRole";

vi.mock("@/data/Settings", () => ({
  fetchStaffFromSupabase: vi.fn(),
  addStaffToSupabase: vi.fn(),
  updateStaffActiveStatus: vi.fn(),
}));

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: vi.fn() }));

// The mobile tree renders the same staff; stub it so assertions aren't
// duplicated across the desktop/mobile layouts.
vi.mock("@/components/mobile/MobileTeamScreen", () => ({ MobileTeamScreen: () => null }));

const mockFetch = vi.mocked(fetchStaffFromSupabase);
const mockRole = vi.mocked(useUserRole);

function staff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "s1",
    name: "Priya Verma",
    role: "admin",
    jobTitle: "Senior CA",
    email: "priya@example.com",
    phone: "9876543210",
    isActive: true,
    joinedDate: "2026-01-15",
    tasksCompleted: 12,
    tasksPending: 3,
    ...overrides,
  };
}

function setRole(isAdmin: boolean) {
  mockRole.mockReturnValue({ role: isAdmin ? "admin" : "staff", isAdmin, loading: false });
}

async function renderStaff(rows: StaffMember[], isAdmin = true) {
  setRole(isAdmin);
  mockFetch.mockResolvedValue(rows);
  render(<StaffManagement />);
  const desktop = within(await screen.findByTestId("desktop-team"));
  return desktop;
}

describe("StaffManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the staff list with name, role badge and contact details", async () => {
    const desktop = await renderStaff([
      staff({ id: "s1", name: "Priya Verma", role: "admin", email: "priya@example.com" }),
      staff({ id: "s2", name: "Rahul Nair", role: "staff", email: "rahul@example.com", phone: "9000000000" }),
    ]);

    await waitFor(() => expect(desktop.getByText("Priya Verma")).toBeInTheDocument());
    expect(desktop.getByText("Rahul Nair")).toBeInTheDocument();
    expect(desktop.getByText("priya@example.com")).toBeInTheDocument();
    expect(desktop.getByText("rahul@example.com")).toBeInTheDocument();
    // "Admin"/"Staff" role labels appear on the member badges (and again in the
    // Role Permissions legend), so there is at least one of each.
    expect(desktop.getAllByText("Admin").length).toBeGreaterThanOrEqual(1);
    expect(desktop.getAllByText("Staff").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the active/inactive summary count", async () => {
    const desktop = await renderStaff([
      staff({ id: "s1", isActive: true }),
      staff({ id: "s2", name: "Inactive Person", isActive: false }),
    ]);

    await waitFor(() => expect(desktop.getByText("1 active, 1 inactive")).toBeInTheDocument());
  });

  it("shows the Add Staff affordance for an admin", async () => {
    const desktop = await renderStaff([staff()], true);
    await waitFor(() => expect(desktop.getByText("Priya Verma")).toBeInTheDocument());

    expect(desktop.getByRole("button", { name: /Add Staff/ })).toBeInTheDocument();
  });

  it("hides the Add Staff affordance for a non-admin", async () => {
    const desktop = await renderStaff([staff()], false);
    await waitFor(() => expect(desktop.getByText("Priya Verma")).toBeInTheDocument());

    expect(desktop.queryByRole("button", { name: /Add Staff/ })).not.toBeInTheDocument();
  });

  it("disables the active-toggle switch for a non-admin (role gating)", async () => {
    const desktop = await renderStaff([staff({ id: "s1", isActive: true })], false);
    await waitFor(() => expect(desktop.getByText("Priya Verma")).toBeInTheDocument());

    // The switch is a role="switch" element gated on isAdmin.
    expect(desktop.getByRole("switch")).toBeDisabled();
  });

  it("enables the active-toggle switch for an admin", async () => {
    const desktop = await renderStaff([staff({ id: "s1", isActive: true })], true);
    await waitFor(() => expect(desktop.getByText("Priya Verma")).toBeInTheDocument());

    expect(desktop.getByRole("switch")).toBeEnabled();
  });

  it("shows the empty state when there are no staff members", async () => {
    const desktop = await renderStaff([], true);
    await waitFor(() => expect(desktop.getByText("No staff members found.")).toBeInTheDocument());
  });

  it("surfaces a load error instead of the list", async () => {
    setRole(true);
    mockFetch.mockRejectedValue(new Error("permission denied"));
    render(<StaffManagement />);

    const desktop = within(await screen.findByTestId("desktop-team"));
    await waitFor(() => expect(desktop.getByText("permission denied")).toBeInTheDocument());
  });
});
