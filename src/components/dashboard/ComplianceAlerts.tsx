import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alerts = [
  { type: "GSTR-3B", due: "20/04/2026", clients: 45, status: "overdue" as const },
  { type: "TDS Challan", due: "07/04/2026", clients: 32, status: "overdue" as const },
  { type: "GSTR-1", due: "11/04/2026", clients: 45, status: "urgent" as const },
  { type: "ITR-1", due: "31/07/2026", clients: 120, status: "upcoming" as const },
  { type: "Advance Tax Q1", due: "15/06/2026", clients: 28, status: "upcoming" as const },
  { type: "DIR-3 KYC", due: "30/09/2026", clients: 15, status: "safe" as const },
];

const statusStyles = {
  overdue: "border-destructive/30 bg-destructive/5",
  urgent: "border-accent/30 bg-accent/5",
  upcoming: "border-warning/30 bg-warning/5",
  safe: "border-success/30 bg-success/5",
};

const dotStyles = {
  overdue: "bg-destructive",
  urgent: "bg-accent",
  upcoming: "bg-warning",
  safe: "bg-success",
};

export function ComplianceAlerts() {
  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">Today's Compliance Alerts</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {alerts.map((a) => (
          <div
            key={a.type}
            className={cn(
              "min-w-[200px] md:min-w-[220px] border rounded-lg p-4 shrink-0",
              statusStyles[a.status]
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("h-2 w-2 rounded-full", dotStyles[a.status])} />
              <span className="font-heading font-semibold text-sm">{a.type}</span>
            </div>
            <p className="text-xs text-muted-foreground">Due: {a.due}</p>
            <p className="text-xs text-muted-foreground mb-3">{a.clients} clients affected</p>
            <button className="flex items-center gap-1.5 text-xs font-medium bg-whatsapp text-whatsapp-foreground px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity w-full justify-center">
              <MessageCircle className="h-3.5 w-3.5" />
              Send Reminder
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
