import { Component, type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, Users, MessageCircle, CalendarClock, Receipt, Newspaper, CreditCard, FileSpreadsheet, LogOut } from "lucide-react";
import { FirmProfileSettings } from "@/components/settings/FirmProfileSettings";
import { StaffManagement } from "@/components/settings/StaffManagement";
import { WhatsAppConfig } from "@/components/settings/WhatsAppConfig";
import { ComplianceCalendarSettings } from "@/components/settings/ComplianceCalendarSettings";
import { InvoiceSettingsPanel } from "@/components/settings/InvoiceSettingsPanel";
import { ComplianceUpdatesFeed } from "@/components/settings/ComplianceUpdatesFeed";
import { SubscriptionBilling } from "@/components/settings/SubscriptionBilling";
import { DataExport } from "@/components/settings/DataExport";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const settingsTabs = [
  { value: "firm", label: "Firm Profile", icon: Building2 },
  { value: "staff", label: "Staff", icon: Users },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "compliance", label: "Compliance", icon: CalendarClock },
  { value: "invoice", label: "Invoice", icon: Receipt },
  { value: "updates", label: "Updates", icon: Newspaper },
  { value: "subscription", label: "Plans", icon: CreditCard },
  { value: "export", label: "Export", icon: FileSpreadsheet },
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
  const [signingOut, setSigningOut] = useState(false);

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
          <Button onClick={handleSignOut} variant="outline" className="gap-2" disabled={signingOut}>
            <LogOut className="h-4 w-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>

        <Tabs defaultValue="firm" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex h-auto p-1 gap-1 bg-muted/50">
              {settingsTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs sm:text-sm px-2.5 py-2 data-[state=active]:bg-background">
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

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
        </Tabs>
      </div>
    </AppLayout>
  );
}
