import { Component, type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, Users, MessageCircle, CalendarClock, Receipt, Newspaper, CreditCard, FileSpreadsheet, LogOut, History } from "lucide-react";
import { FirmProfileSettings } from "@/components/settings/FirmProfileSettings";
import { StaffManagement } from "@/components/settings/StaffManagement";
import { WhatsAppConfig } from "@/components/settings/WhatsAppConfig";
import { ComplianceCalendarSettings } from "@/components/settings/ComplianceCalendarSettings";
import { InvoiceSettingsPanel } from "@/components/settings/InvoiceSettingsPanel";
import { ComplianceUpdatesFeed } from "@/components/settings/ComplianceUpdatesFeed";
import { SubscriptionBilling } from "@/components/settings/SubscriptionBilling";
import { DataExport } from "@/components/settings/DataExport";
import { AuditTrail } from "@/components/settings/AuditTrail";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

// M40, ISSUES.md — was 9 tabs (8 for non-admins) crammed into one
// horizontally-scrolling row, which overflowed on tablet/mobile. Grouped
// into the review's own 4 named sections; each tab keeps its real
// TabsTrigger (same `value`/role="tab"/data-state semantics e2e already
// relies on via getByRole('tab', ...)) so nothing downstream changes —
// only the layout they're arranged in does. One shared nav (not a
// separate desktop/mobile copy) reflows via CSS Grid: a single column
// (list) above the content on mobile, a narrow sticky side column
// (vertical sub-nav) beside the content at md+.
const settingsGroups = [
  {
    label: "Firm",
    tabs: [
      { value: "firm", label: "Firm Profile", icon: Building2 },
      { value: "compliance", label: "Compliance", icon: CalendarClock },
      { value: "updates", label: "Updates", icon: Newspaper },
    ],
  },
  {
    label: "Team & Access",
    tabs: [
      { value: "staff", label: "Staff", icon: Users },
      { value: "audit", label: "Audit Trail", icon: History, adminOnly: true },
    ],
  },
  {
    label: "Integrations",
    tabs: [{ value: "whatsapp", label: "WhatsApp", icon: MessageCircle }],
  },
  {
    label: "Billing & Data",
    tabs: [
      { value: "invoice", label: "Invoice", icon: Receipt },
      { value: "subscription", label: "Plans", icon: CreditCard },
      { value: "export", label: "Export", icon: FileSpreadsheet },
    ],
  },
];

class SettingsTabErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Settings tab crashed:", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState("firm");
  const visibleGroups = settingsGroups
    .map((group) => ({ ...group, tabs: group.tabs.filter((tab) => !tab.adminOnly || isAdmin) }))
    .filter((group) => group.tabs.length > 0);

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);
    if (error) {
      toast.error(error.message ?? "Logout failed. Please try again.");
      return;
    }
    navigate("/login", { replace: true });
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your firm profile, staff, integrations, and preferences</p>
          </div>
          {/* md:hidden (L8, ISSUES.md) — DesktopSidebar (hidden md:flex,
              i.e. desktop-only) already has its own Sign out button, so
              this one was a duplicate on desktop. Can't remove it outright
              though: the sidebar doesn't render at all on mobile, and
              MobileBottomNav/MobileFAB have no sign-out affordance of their
              own — this button is mobile's *only* way to sign out. */}
          <Button onClick={handleSignOut} variant="outline" className="gap-2 md:hidden" disabled={signingOut}>
            <LogOut className="h-4 w-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="grid gap-6 md:grid-cols-[200px_1fr] md:items-start">
          <nav className="space-y-5 md:sticky md:top-6">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2.5 mb-1.5">
                  {group.label}
                </p>
                <TabsList className="flex flex-col h-auto w-full gap-0.5 bg-transparent p-0">
                  {group.tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      aria-label={tab.label}
                      className="w-full justify-start gap-2 px-2.5 py-2 text-sm data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      <tab.icon className="h-4 w-4 shrink-0" />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            ))}
          </nav>

          <div className="min-w-0">
            <TabsContent value="firm"><FirmProfileSettings /></TabsContent>
            <TabsContent value="staff">
              <SettingsTabErrorBoundary fallback={<div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Failed to load staff settings.</div>}>
                <StaffManagement />
              </SettingsTabErrorBoundary>
            </TabsContent>
            <TabsContent value="whatsapp"><WhatsAppConfig /></TabsContent>
            <TabsContent value="compliance"><ComplianceCalendarSettings /></TabsContent>
            <TabsContent value="invoice"><InvoiceSettingsPanel /></TabsContent>
            <TabsContent value="updates"><ComplianceUpdatesFeed /></TabsContent>
            <TabsContent value="subscription"><SubscriptionBilling /></TabsContent>
            <TabsContent value="export"><DataExport /></TabsContent>
            <TabsContent value="audit"><AuditTrail /></TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
