import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Clock, AlertTriangle } from "lucide-react";
import { mockTasks } from "@/data/mockTasks";

type Filter = "all" | "this_week" | "this_month" | "overdue";

export function PendingWorkReport() {
  const [filter, setFilter] = useState<Filter>("all");

  const openTasks = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return mockTasks
      .filter((t) => t.status !== "completed")
      .filter((t) => {
        const due = new Date(t.dueDate);
        if (filter === "overdue") return due < now;
        if (filter === "this_week") return due <= weekEnd;
        if (filter === "this_month") return due <= monthEnd;
        return true;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [filter]);

  const isOverdue = (date: string) => new Date(date) < new Date();

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All Open" },
    { key: "this_week", label: "Due This Week" },
    { key: "this_month", label: "Due This Month" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-heading">Pending Work Report</CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5 w-fit">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {openTasks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No pending tasks found for this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {openTasks.map((task) => (
              <div key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{task.clientName}</span>
                    <Badge variant="secondary" className="text-xs">{task.taskType}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned to {task.assignedTo} · {task.financialYear}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1 text-xs font-medium ${isOverdue(task.dueDate) ? "text-destructive" : "text-muted-foreground"}`}>
                    {isOverdue(task.dueDate) && <AlertTriangle className="h-3.5 w-3.5" />}
                    {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  <Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"} className="text-xs capitalize">
                    {task.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
