import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, LayoutGrid, List, CalendarDays, Zap, Search } from "lucide-react";
import { mockTasks, Task } from "@/data/mockTasks";
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { BulkTaskGenerator } from "@/components/tasks/BulkTaskGenerator";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [view, setView] = useState<"kanban" | "list" | "calendar">("kanban");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !search ||
        t.clientName.toLowerCase().includes(search.toLowerCase()) ||
        t.taskType.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [tasks, search, priorityFilter]);

  const handleStatusChange = (taskId: string, status: Task["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    overdue: tasks.filter((t) => {
      const days = (new Date(t.dueDate).getTime() - Date.now()) / 86400000;
      return days < 0 && t.status !== "completed";
    }).length,
  };

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
              {stats.total} total · {stats.pending} pending · <span className="text-red-600">{stats.overdue} overdue</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setBulkOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Zap className="h-4 w-4" /> Bulk Generate
            </Button>
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5 bg-accent hover:bg-accent/90 text-white">
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
              <TabsTrigger value="kanban" className="gap-1.5"><LayoutGrid className="h-4 w-4" /> <span className="hidden md:inline">Kanban</span></TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5"><List className="h-4 w-4" /> <span className="hidden md:inline">List</span></TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="h-4 w-4" /> <span className="hidden md:inline">Calendar</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {view === "kanban" && <TaskKanbanBoard tasks={filteredTasks} onStatusChange={handleStatusChange} />}
        {view === "list" && <TaskListView tasks={filteredTasks} onStatusChange={handleStatusChange} />}
        {view === "calendar" && <TaskCalendarView tasks={filteredTasks} />}

        {/* Modals */}
        <AddTaskModal open={addOpen} onOpenChange={setAddOpen} />
        <BulkTaskGenerator open={bulkOpen} onOpenChange={setBulkOpen} />
      </div>
    </AppLayout>
  );
}
