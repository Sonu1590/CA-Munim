import { FileText, MessageCircle, Receipt, CheckCircle2, UserPlus } from "lucide-react";

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  type: "task" | "document" | "invoice" | "client";
}

interface RecentActivityProps {
  items?: ActivityItem[];
}

const iconMap = {
  task: CheckCircle2,
  document: MessageCircle,
  invoice: Receipt,
  client: UserPlus,
};

const colorMap = {
  task: "text-success",
  document: "text-whatsapp",
  invoice: "text-accent",
  client: "text-primary",
};

function timeAgo(timestamp: string): string {
  if (!timestamp) return "";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

export function RecentActivity({ items }: RecentActivityProps) {
  if (!items || items.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-heading font-semibold mb-3">Recent Activity</h2>
        <div className="bg-card rounded-lg card-shadow p-6 text-center text-sm text-muted-foreground">
          No recent activity yet. Start by adding clients and creating tasks.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">Recent Activity</h2>
      <div className="bg-card rounded-lg card-shadow divide-y divide-border">
        {items.map((a) => {
          const Icon = iconMap[a.type] ?? FileText;
          const color = colorMap[a.type] ?? "text-muted-foreground";
          return (
            <div key={a.id} className="flex items-start gap-3 p-3.5">
              <div className={`${color} mt-0.5`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{a.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(a.timestamp)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
