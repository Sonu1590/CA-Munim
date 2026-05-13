import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, LayoutGrid, List, CalendarDays, Zap, Search, Loader2, AlertCircle } from "lucide-react";
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { BulkTaskGenerator } from "@/components/tasks/BulkTaskGenerator";
import { useTasks } from "@/hooks/useTasks"; 
import { toast } from "sonner";

// Keep these exports here so child components (AddTaskModal etc.) 
// can still import them from this file if needed
export { taskTypeGroups, taskTypeIcons, dueDateRules, staffMembers, financialYears, quarters, months } from "@/data/Tasks";
export type { Task, TaskType, TaskStatus, TaskPriority, ChecklistItem } from "@/data/Tasks";

export default function Tasks() {
  const [view, setView] = useState<"kanban" | "list" | "calendar">("kanban");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);  
  const { tasks, loading, error, updateTaskStatus, refetch, addTask } = useTasks();

  // ── Map Supabase task shape → shape that child components expect ─────────
  // useTasks returns a slightly different shape than mockTasks.
  // We normalise here so TaskKanbanBoard / TaskListView need zero changes.
  const normalisedTasks = useMemo(() => {
    return tasks.map((t) => ({
      id: t.id,
      clientName: t.clientName,
      clientId: t.clientId,
      taskType: t.taskType as any,
      customTaskName: t.customName,
      financialYear: t.financialYear,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      assignedTo: t.assignedToName ?? "Unassigned",
      assignedInitials: t.assignedToName
        ? t.assignedToName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
        : "?",
      docsReceived: (t.documentChecklist ?? []).filter((d: any) => d.received || d.checked).length,
      docsTotal: (t.documentChecklist ?? []).length,
      notes: t.notes,
      documentChecklist: t.documentChecklist,
    }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return normalisedTasks.filter((t) => {
      const matchSearch =
        !search ||
        t.clientName.toLowerCase().includes(search.toLowerCase()) ||
        t.taskType.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [normalisedTasks, search, priorityFilter]);

  // Status change — writes to Supabase, then optimistically updates UI
  const handleStatusChange = async (taskId: string, status: "pending" | "in_progress" | "completed") => {
    await updateTaskStatus(taskId, status);
  };

  const stats = {
    total: normalisedTasks.length,
    pending: normalisedTasks.filter((t) => t.status === "pending").length,
    overdue: normalisedTasks.filter((t) => {
      const days = (new Date(t.dueDate).getTime() - Date.now()) / 86400000;
      return days < 0 && t.status !== "completed";
    }).length,
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading tasks...</span>
        </div>
      </AppLayout>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Try Again</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">
              Tasks & Deadlines
            </h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} total · {stats.pending} pending ·{" "}
              <span className="text-red-600">{stats.overdue} overdue</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setBulkOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Zap className="h-4 w-4" /> Bulk Generate
            </Button>
            <Button
              onClick={() => setAddOpen(true)}
              size="sm"
              className="gap-1.5 bg-accent hover:bg-accent/90 text-white"
            >
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          </div>
        </div>

        {/* Filters + View Toggle */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks or clients..."
              className="pl-9"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="ml-auto">
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1.5">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden md:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="h-4 w-4" />
                <span className="hidden md:inline">List</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden md:inline">Calendar</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Empty state */}
        {normalisedTasks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground space-y-3">
            <p className="text-lg font-medium">No tasks yet</p>
            <p className="text-sm">Add your first task to get started.</p>
            <Button
              className="bg-accent text-white hover:bg-accent/90 mt-2"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add First Task
            </Button>
          </div>
        )}

        {/* Content */}
        {normalisedTasks.length > 0 && (
          <>
            {view === "kanban" && (
              <TaskKanbanBoard tasks={filteredTasks} onStatusChange={handleStatusChange} />
            )}
            {view === "list" && (
              <TaskListView tasks={filteredTasks} onStatusChange={handleStatusChange} />
            )}
            {view === "calendar" && <TaskCalendarView tasks={filteredTasks} />}
          </>
        )}

        {/* Modals */}
        <AddTaskModal
          open={addOpen}
          onOpenChange={setAddOpen}
          onSave={async (taskData) => {
            const success = await addTask(taskData);

            if (success) {
              await refetch();

              toast.success("Task created successfully");

              setAddOpen(false);
            } else {
              toast.error("Failed to create task");
            }
         }}
        />
        <BulkTaskGenerator
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          onGenerated={refetch} // refresh after bulk create
        />
      </div>
    </AppLayout>
  );
}
