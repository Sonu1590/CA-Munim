import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, ClipboardList, TrendingUp, BookOpen, Calendar, Users, Wallet } from "lucide-react";
import { ComplianceStatusReport } from "@/components/reports/ComplianceStatusReport";
import { PendingWorkReport } from "@/components/reports/PendingWorkReport";
import { FYSummaryReport } from "@/components/reports/FYSummaryReport";
import { ClientLedgerReport } from "@/components/reports/ClientLedgerReport";
import { ComplianceCalendarReport } from "@/components/reports/ComplianceCalendarReport";
import { StaffProductivityReport } from "@/components/reports/StaffProductivityReport";
import { ReceivablesAgingReport } from "@/components/reports/ReceivablesAgingReport";

const reportTabs = [
  { value: "compliance", label: "Compliance", shortLabel: "Compliance", icon: BarChart3 },
  { value: "pending", label: "Pending Work", shortLabel: "Pending", icon: ClipboardList },
  { value: "fy-summary", label: "FY Summary", shortLabel: "FY", icon: TrendingUp },
  { value: "aging", label: "Receivables Aging", shortLabel: "Aging", icon: Wallet },
  { value: "ledger", label: "Client Ledger", shortLabel: "Ledger", icon: BookOpen },
  { value: "calendar", label: "Compliance Calendar", shortLabel: "Calendar", icon: Calendar },
  { value: "staff", label: "Staff Productivity", shortLabel: "Staff", icon: Users },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState("compliance");

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Generate & export practice reports</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {reportTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-xs sm:text-sm px-2.5 py-2"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="compliance"><ComplianceStatusReport /></TabsContent>
          <TabsContent value="pending"><PendingWorkReport /></TabsContent>
          <TabsContent value="fy-summary"><FYSummaryReport /></TabsContent>
          <TabsContent value="aging"><ReceivablesAgingReport /></TabsContent>
          <TabsContent value="ledger"><ClientLedgerReport /></TabsContent>
          <TabsContent value="calendar"><ComplianceCalendarReport /></TabsContent>
          <TabsContent value="staff"><StaffProductivityReport /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
