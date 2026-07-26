import { AlertTriangle, CalendarClock, PartyPopper, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DigestItem {
  id: string;
  taskType: string;
  clientId: string;
  clientName: string;
  dueDate: string;
  daysOverdue: number;
}

interface TodayDigestProps {
  items?: DigestItem[];
}

// The dashboard is a glance, not the full worklist — Tasks already is that.
// useDashboard's fetchDigest queries up to 50 items; rendering all of them
// inline pushed every other dashboard section (metrics, compliance alerts,
// activity) hundreds of pixels below the fold on any firm with a real
// backlog. Capped here, in the component that renders the list, rather
// than in the hook, so the true total is still available for the header
// count and for a future "view all" deep link.
const VISIBLE_LIMIT = 5;

export function TodayDigest({ items }: TodayDigestProps) {
  const navigate = useNavigate();
  const overdue = (items ?? []).filter((i) => i.daysOverdue > 0);
  const dueToday = (items ?? []).filter((i) => i.daysOverdue === 0);
  const all = [...overdue, ...dueToday];
  const visible = all.slice(0, VISIBLE_LIMIT);
  const hiddenCount = all.length - visible.length;

  if (overdue.length === 0 && dueToday.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-heading font-semibold mb-3">Today's Digest</h2>
        <div className="bg-card rounded-lg card-shadow p-6 text-center flex flex-col items-center gap-2">
          <PartyPopper className="h-6 w-6 text-success" />
          <p className="text-sm text-muted-foreground">Nothing due or overdue — you're caught up.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">
        Today's Digest
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {overdue.length + dueToday.length} item{overdue.length + dueToday.length === 1 ? "" : "s"} need attention
        </span>
      </h2>
      <div className="bg-card rounded-lg card-shadow divide-y divide-border">
        {visible.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-3.5">
            {i.daysOverdue > 0 ? (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            ) : (
              <CalendarClock className="h-4 w-4 text-warning shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{i.taskType}</span> for {i.clientName}
              </p>
              {i.daysOverdue > 0 ? (
                <p className="text-xs text-destructive mt-0.5">
                  {i.daysOverdue} day{i.daysOverdue === 1 ? "" : "s"} overdue
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Due today</p>
              )}
            </div>
          </div>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="w-full flex items-center justify-center gap-1.5 p-3 text-sm font-medium text-primary hover:bg-muted/50 transition-colors"
          >
            +{hiddenCount} more — View all in Tasks
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </section>
  );
}
