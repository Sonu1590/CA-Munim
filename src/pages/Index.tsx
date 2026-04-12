import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { ComplianceAlerts } from "@/components/dashboard/ComplianceAlerts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MonthlyWork } from "@/components/dashboard/MonthlyWork";
import { QuickActions } from "@/components/dashboard/QuickActions";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Mobile header */}
        <div className="md:hidden">
          <h1 className="text-xl font-heading font-bold text-primary">CA Munim</h1>
          <p className="text-sm text-muted-foreground">Good morning, CA Rajesh 👋</p>
        </div>
        <div className="hidden md:block">
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, CA Rajesh Sharma</p>
        </div>

        <MetricCards />
        <ComplianceAlerts />

        <div className="grid md:grid-cols-2 gap-6">
          <RecentActivity />
          <div className="space-y-6">
            <MonthlyWork />
            <QuickActions />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
