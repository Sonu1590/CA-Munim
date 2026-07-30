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
      {/* M36, ISSUES.md — theme-organic pilots the mobile "Organic"
          palette on this one page per the user's explicit preference.
          Scoped to the page content only (sidebar/nav stay as-is); has
          no effect on the mobile tree below, which already uses its own
          separate mobile-* tokens, not these CSS variables. Full-width +
          bg-background/text-foreground here (not just on the centered
          column below) because CSS custom-property overrides don't
          retroactively repaint an ancestor's already-inherited color —
          without re-applying these explicitly at the top of the scope,
          un-classed text and the margins beside the centered column
          would keep the old (non-organic) colors. */}
      <div className="theme-organic bg-background text-foreground min-h-full">
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
          {/* Desktop header — mobile has its own header inside MobileHomeScreen */}
          <div className="hidden md:block">
            <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
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
      </div>
    </AppLayout>
  );
};

export default Dashboard;
