import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { getPendingWork, type PendingWorkFilter } from "@/data/Reports";

type Filter = PendingWorkFilter;

export function PendingWorkReport() {
  const [filter, setFilter] = useState<Filter>("all");
  const [openTasks, setOpenTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const tasks = await getPendingWork(filter);
        setOpenTasks(tasks);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load pending tasks");
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
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
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading tasks...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : openTasks.length === 0 ? (
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
