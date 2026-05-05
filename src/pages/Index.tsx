import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { ComplianceAlerts } from "@/components/dashboard/ComplianceAlerts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MonthlyWork } from "@/components/dashboard/MonthlyWork";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useDashboard } from "@/hooks/useDashboard";  // ← NEW
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  // ── Real data from Supabase ────────────────────────────────────────────────
  const {
    metrics,
    complianceAlerts,
    activity,
    monthlyWork,
    loading,
    caName,
  } = useDashboard();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayName = caName ? `CA ${caName}` : "CA";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Mobile header */}
        <div className="md:hidden">
          <h1 className="text-xl font-heading font-bold text-primary">CA Munim</h1>
          <p className="text-sm text-muted-foreground">
            {greeting()}, {displayName} 👋
          </p>
        </div>
        <div className="hidden md:block">
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {displayName}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading dashboard...</span>
          </div>
        ) : (
          <>
            {/* Pass real metrics to existing components */}
            <MetricCards metrics={metrics} />
            <ComplianceAlerts alerts={complianceAlerts} />
            <div className="grid md:grid-cols-2 gap-6">
              <RecentActivity items={activity} />
              <div className="space-y-6">
                <MonthlyWork data={monthlyWork} />
                <QuickActions />
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
