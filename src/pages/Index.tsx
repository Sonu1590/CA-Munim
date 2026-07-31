import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { TodayDigest } from "@/components/dashboard/TodayDigest";
import { ComplianceAlerts } from "@/components/dashboard/ComplianceAlerts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MonthlyWork } from "@/components/dashboard/MonthlyWork";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { MobileHomeScreen } from "@/components/mobile/MobileHomeScreen";
import { useDashboard } from "@/hooks/useDashboard";  // ← NEW
import { MetricCardsSkeleton } from "@/components/common/MetricCardsSkeleton";
import { CardListSkeleton } from "@/components/common/CardListSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  // ── Real data from Supabase ────────────────────────────────────────────────
  const {
    metrics,
    complianceAlerts,
    digest,
    activity,
    monthlyWork,
    loading,
    caName,
    refetch,
  } = useDashboard();

  const displayName = caName ? `CA ${caName}` : "CA";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Desktop header — mobile has its own header inside MobileHomeScreen */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {displayName}
          </p>
        </div>

        {loading ? (
          // M29, ISSUES.md — was a blank-page spinner; skeletons matching
          // the metric-card grid + list widgets avoid the layout-shift
          // "pop-in" once real dashboard data lands.
          <div className="space-y-6">
            <span className="sr-only" role="status">Loading dashboard...</span>
            <MetricCardsSkeleton count={4} />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <CardListSkeleton count={4} />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <CardListSkeleton count={4} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="md:hidden" data-testid="mobile-home">
              <MobileHomeScreen
                metrics={metrics}
                complianceAlerts={complianceAlerts}
                digest={digest}
                caName={caName}
                refetch={refetch}
              />
            </div>
            <div className="hidden md:block space-y-6" data-testid="desktop-dashboard">
              {/* Pass real metrics to existing components */}
              <TodayDigest items={digest} />
              <MetricCards metrics={metrics} />
              <ComplianceAlerts alerts={complianceAlerts} />
              <div className="grid md:grid-cols-2 gap-6">
                <RecentActivity items={activity} />
                <div className="space-y-6">
                  <MonthlyWork data={monthlyWork} />
                  <QuickActions />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
