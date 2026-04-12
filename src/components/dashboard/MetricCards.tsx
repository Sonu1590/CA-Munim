import { Users, AlertTriangle, IndianRupee, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";

const metrics = [
  { label: "Total Clients", value: "247", icon: Users, color: "text-primary", bg: "bg-primary/10" },
  { label: "Overdue Tasks", value: "12", icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", badge: true },
  { label: "Pending Fees", value: "₹4,82,500", icon: IndianRupee, color: "text-accent", bg: "bg-accent/10" },
  { label: "Due This Week", value: "34", icon: CalendarClock, color: "text-primary", bg: "bg-primary/10" },
];

export function MetricCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {metrics.map((m, i) => (
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
