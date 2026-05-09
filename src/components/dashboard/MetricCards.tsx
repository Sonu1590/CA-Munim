import { Users, AlertTriangle, IndianRupee, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";

interface MetricCardsProps {
  metrics?: {
    totalClients: number;
    overdueTasks: number;
    pendingFees: number;
    dueThisWeek: number;
  };
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const cards = [
    {
      label: "Total Clients",
      value: metrics ? String(metrics.totalClients) : "—",
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      badge: false,
    },
    {
      label: "Overdue Tasks",
      value: metrics ? String(metrics.overdueTasks) : "—",
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      badge: metrics ? metrics.overdueTasks > 0 : false,
    },
    {
      label: "Pending Fees",
      value: metrics
        ? `₹${metrics.pendingFees.toLocaleString("en-IN")}`
        : "—",
      icon: IndianRupee,
      color: "text-accent",
      bg: "bg-accent/10",
      badge: false,
    },
    {
      label: "Due This Week",
      value: metrics ? String(metrics.dueThisWeek) : "—",
      icon: CalendarClock,
      color: "text-primary",
      bg: "bg-primary/10",
      badge: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="bg-card rounded-lg p-4 card-shadow hover:card-shadow-hover transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`${m.bg} ${m.color} p-2 rounded-lg`}>
              <m.icon className="h-5 w-5" />
            </div>
            {m.badge && (
              <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                !
              </span>
            )}
          </div>
          <p className="text-2xl font-heading font-bold">{m.value}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{m.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
