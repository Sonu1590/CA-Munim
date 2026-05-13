import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Loader2 } from "lucide-react";
import { fetchClientsFromSupabase } from "@/data/Clients";
import {
  dueDateRules,
  fetchComplianceTasksForClient,
  financialYears,
  months,
  Task,
  TaskType,
} from "@/data/Tasks";
import { downloadHtmlReport, slugifyFileName } from "@/lib/downloads";
import { toast } from "sonner";

function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  }
  return `FY ${year - 1}-${String(year).slice(-2)}`;
}

function parseDueDate(isoDate: string) {
  const raw = isoDate?.trim() ?? "";
  if (!raw) return null;
  return raw.includes("T") ? parseISO(raw) : parseISO(`${raw.slice(0, 10)}T12:00:00`);
}

function monthBucketFromDueDate(isoDate: string): string | null {
  const d = parseDueDate(isoDate);
  if (!d || Number.isNaN(d.getTime())) return null;
  return format(d, "MMMM");
}

function ruleHint(taskType: string): string | undefined {
  return dueDateRules[taskType as TaskType];
}

export function ComplianceCalendarReport() {
  const [clientId, setClientId] = useState("");
  const [financialYear, setFinancialYear] = useState(getCurrentFY);
  const [clients, setClients] = useState<{ id: string; name: string; servicesSubscribed?: string[] }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      setLoadingClients(true);
      setClientsError(null);
      try {
        const data = await fetchClientsFromSupabase();
        setClients(data);
      } catch (err: unknown) {
        setClientsError(err instanceof Error ? err.message : "Failed to load clients");
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, []);

  useEffect(() => {
    if (!clientId || !financialYear) {
      setTasks([]);
      setTasksError(null);
      return;
    }

    const loadTasks = async () => {
      setLoadingTasks(true);
      setTasksError(null);
      try {
        const rows = await fetchComplianceTasksForClient(clientId, financialYear);
        setTasks(rows);
      } catch (err: unknown) {
        setTasks([]);
        setTasksError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        setLoadingTasks(false);
      }
    };
    loadTasks();
  }, [clientId, financialYear]);

  const client = clients.find((c) => c.id === clientId);

  const tasksByFYMonth = (() => {
    const buckets: Record<string, Task[]> = {};
    for (const m of months) {
      buckets[m] = [];
    }
    for (const t of tasks) {
      const key = monthBucketFromDueDate(t.dueDate);
      if (key && buckets[key]) {
        buckets[key].push(t);
      }
    }
    return buckets;
  })();

  const displayTitle = (t: Task) =>
    t.taskType === "Custom" && t.customTaskName?.trim()
      ? t.customTaskName
      : String(t.taskType);

  const formatDue = (due: string) => {
    const d = parseDueDate(due);
    return d && !Number.isNaN(d.getTime()) ? format(d, "dd MMM yyyy") : due || "—";
  };

  const exportCalendar = () => {
    const rows = months.flatMap((month) =>
      (tasksByFYMonth[month] ?? []).map((task) => ({
        month,
        task: displayTitle(task),
        dueDate: formatDue(task.dueDate),
        assignedTo: task.assignedTo || "Unassigned",
        priority: task.priority,
        status: task.status.replace("_", " "),
        rule: ruleHint(task.taskType) ?? "",
      })),
    );

    downloadHtmlReport(
      `${slugifyFileName(`compliance-calendar-${client?.name ?? "client"}-${financialYear}`)}.html`,
      "Compliance Calendar",
      rows,
      [
        { header: "FY Month", value: (row) => row.month },
        { header: "Task", value: (row) => row.task },
        { header: "Due Date", value: (row) => row.dueDate, align: "center" },
        { header: "Assigned To", value: (row) => row.assignedTo },
        { header: "Priority", value: (row) => row.priority, align: "center" },
        { header: "Status", value: (row) => row.status, align: "center" },
        { header: "Rule", value: (row) => row.rule },
      ],
      {
        Client: client?.name ?? "Not selected",
        "Financial year": financialYear,
        Services: client?.servicesSubscribed?.length ? client.servicesSubscribed.join(", ") : "-",
      },
    );
    toast.success("Compliance calendar downloaded");
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-heading">Compliance Calendar</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={clientId || undefined} onValueChange={setClientId}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={financialYear} onValueChange={setFinancialYear}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue placeholder="FY" />
              </SelectTrigger>
              <SelectContent>
                {financialYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="gap-1.5"
              onClick={exportCalendar}
              disabled={!clientId || loadingClients || loadingTasks || !!clientsError || !!tasksError}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingClients ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading clients...</span>
          </div>
        ) : clientsError ? (
          <div className="p-8 text-center text-destructive">{clientsError}</div>
        ) : (
          <>
            {!clientId && (
              <div className="mb-4 p-3 rounded-xl border border-dashed border-muted-foreground/30 text-sm text-muted-foreground text-center">
                Select a client to view scheduled tasks from Tasks & Deadlines for the chosen FY.
              </div>
            )}
            {client && (
              <div className="mb-4 p-3 bg-primary/5 rounded-xl text-sm border border-primary/10">
                <p className="font-medium">{client.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Services: {client.servicesSubscribed?.length ? client.servicesSubscribed.join(", ") : "—"}
                </p>
              </div>
            )}

            {tasksError && (
              <div className="mb-3 p-3 text-sm text-destructive bg-destructive/5 rounded-lg border border-destructive/15">
                {tasksError}
              </div>
            )}

            {loadingTasks ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading compliance tasks...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {months.map((m) => {
                  const bucket = tasksByFYMonth[m] ?? [];
                  return (
                    <div key={m} className="border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{m}</span>
                      </div>
                      {bucket.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {!clientId
                            ? "Select a client to see tasks."
                            : "No open tasks scheduled for this FY month."}
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {bucket.map((t) => (
                            <li key={t.id} className="text-xs flex items-start gap-2">
                              <span className="text-accent mt-0.5">●</span>
                              <div className="min-w-0">
                                <span className="font-medium block">{displayTitle(t)}</span>
                                <p className="text-muted-foreground">Due {formatDue(t.dueDate)}</p>
                                {ruleHint(t.taskType) && (
                                  <p className="text-[11px] text-muted-foreground/90 mt-0.5">
                                    {ruleHint(t.taskType)}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
