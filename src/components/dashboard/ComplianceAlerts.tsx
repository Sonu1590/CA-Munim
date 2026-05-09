import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplianceAlert {
  id: string;
  filingType: string;
  dueDate: string;
  clientsAffected: number;
  daysUntilDue: number;
  urgency: "safe" | "upcoming" | "overdue";
}

interface ComplianceAlertsProps {
  alerts?: ComplianceAlert[];
}

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

function formatDueDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ComplianceAlerts({ alerts }: ComplianceAlertsProps) {
  // Show placeholder cards while loading
  if (!alerts || alerts.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-heading font-semibold mb-3">Today's Compliance Alerts</h2>
        <div className="text-sm text-muted-foreground bg-card rounded-lg p-6 text-center card-shadow">
          No upcoming compliance deadlines in the next 30 days.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">Today's Compliance Alerts</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {alerts.map((a) => {
          // Map urgency — treat "upcoming" with ≤ 7 days as urgent visually
          const visualStatus =
            a.urgency === "overdue"
              ? "overdue"
              : a.daysUntilDue <= 7
              ? "urgent"
              : a.daysUntilDue <= 30
              ? "upcoming"
              : "safe";

          return (
            <div
              key={a.id}
              className={cn(
                "min-w-[200px] md:min-w-[220px] border rounded-lg p-4 shrink-0",
                statusStyles[visualStatus]
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("h-2 w-2 rounded-full", dotStyles[visualStatus])} />
                <span className="font-heading font-semibold text-sm">{a.filingType}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Due: {formatDueDate(a.dueDate)}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {a.clientsAffected} client{a.clientsAffected !== 1 ? "s" : ""} affected
              </p>
              {a.daysUntilDue < 0 && (
                <p className="text-xs text-destructive font-medium mb-2">
                  {Math.abs(a.daysUntilDue)} days overdue
                </p>
              )}
              <button className="flex items-center gap-1.5 text-xs font-medium bg-whatsapp text-whatsapp-foreground px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity w-full justify-center">
                <MessageCircle className="h-3.5 w-3.5" />
                Send Reminder
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
