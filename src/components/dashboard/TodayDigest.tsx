import { AlertTriangle, CalendarClock, PartyPopper } from "lucide-react";

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

export function TodayDigest({ items }: TodayDigestProps) {
  const overdue = (items ?? []).filter((i) => i.daysOverdue > 0);
  const dueToday = (items ?? []).filter((i) => i.daysOverdue === 0);

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
        {overdue.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-3.5">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{i.taskType}</span> for {i.clientName}
              </p>
              <p className="text-xs text-destructive mt-0.5">
                {i.daysOverdue} day{i.daysOverdue === 1 ? "" : "s"} overdue
              </p>
            </div>
          </div>
        ))}
        {dueToday.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-3.5">
            <CalendarClock className="h-4 w-4 text-warning shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{i.taskType}</span> for {i.clientName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Due today</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
