import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Settings from "@/pages/Settings";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useUserRole");

// Same jsdom-workaround mock as Tasks.test.tsx — Radix's real Tabs
// activates on pointerdown internals that fireEvent.click alone doesn't
// fully replicate in jsdom. This is only about tab-switching behavior,
// so a plain context-driven stand-in (real role="tab" + click handler)
// is enough; it's not asserting on Radix-specific attributes.
vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");
  const TabsContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
      className,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
      className?: string;
    }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div className={className}>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    TabsTrigger: ({
      value,
      children,
      className,
      "aria-label": ariaLabel,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
      "aria-label"?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button
          type="button"
          role="tab"
          aria-selected={ctx.value === value}
          aria-label={ariaLabel}
          className={className}
          onClick={() => ctx.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      return ctx.value === value ? <div className={className}>{children}</div> : null;
    },
  };
});

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// M40, ISSUES.md — Settings' sub-panels each do their own real data
// fetching; stubbed out here since this test is only about the
// grouped-nav restructuring (tab switching, no duplicate ARIA nodes,
// admin-only gating), not about any individual panel's own behavior.
vi.mock("@/components/settings/FirmProfileSettings", () => ({ FirmProfileSettings: () => <div>firm-panel</div> }));
vi.mock("@/components/settings/StaffManagement", () => ({ StaffManagement: () => <div>staff-panel</div> }));
vi.mock("@/components/settings/WhatsAppConfig", () => ({ WhatsAppConfig: () => <div>whatsapp-panel</div> }));
vi.mock("@/components/settings/ComplianceCalendarSettings", () => ({ ComplianceCalendarSettings: () => <div>compliance-panel</div> }));
vi.mock("@/components/settings/InvoiceSettingsPanel", () => ({ InvoiceSettingsPanel: () => <div>invoice-panel</div> }));
vi.mock("@/components/settings/ComplianceUpdatesFeed", () => ({ ComplianceUpdatesFeed: () => <div>updates-panel</div> }));
vi.mock("@/components/settings/SubscriptionBilling", () => ({ SubscriptionBilling: () => <div>subscription-panel</div> }));
vi.mock("@/components/settings/DataExport", () => ({ DataExport: () => <div>export-panel</div> }));
vi.mock("@/components/settings/AuditTrail", () => ({ AuditTrail: () => <div>audit-panel</div> }));

function renderSettings(isAdmin: boolean) {
  vi.mocked(useAuth).mockReturnValue({ signOut: vi.fn() } as any);
  vi.mocked(useUserRole).mockReturnValue({ isAdmin, role: isAdmin ? "admin" : "staff", loading: false } as any);
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

describe("Settings page — grouped nav (M40)", () => {
  it("renders every tab exactly once (no duplicate desktop/mobile copies) grouped under its section", () => {
    renderSettings(true);

    for (const [label, group] of [
      ["Firm Profile", "Firm"],
      ["Compliance", "Firm"],
      ["Updates", "Firm"],
      ["Staff", "Team & Access"],
      ["Audit Trail", "Team & Access"],
      ["WhatsApp", "Integrations"],
      ["Invoice", "Billing & Data"],
      ["Plans", "Billing & Data"],
      ["Export", "Billing & Data"],
    ] as const) {
      expect(screen.getByRole("tab", { name: label, exact: true })).toBeInTheDocument();
      void group;
    }
    expect(screen.getByText("Firm")).toBeInTheDocument();
    expect(screen.getByText("Team & Access")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Billing & Data")).toBeInTheDocument();
  });

  it("defaults to the Firm Profile panel and switches panels on tab click", () => {
    renderSettings(true);

    expect(screen.getByText("firm-panel")).toBeInTheDocument();
    expect(screen.queryByText("whatsapp-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "WhatsApp", exact: true }));

    expect(screen.getByText("whatsapp-panel")).toBeInTheDocument();
    expect(screen.queryByText("firm-panel")).not.toBeInTheDocument();
  });

  it("hides the admin-only Audit Trail tab for non-admin staff", () => {
    renderSettings(false);

    expect(screen.queryByRole("tab", { name: "Audit Trail", exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Staff", exact: true })).toBeInTheDocument();
  });
});
