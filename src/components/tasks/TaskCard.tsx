import { useEffect, useState } from "react";
import { Task, taskTypeIcons } from "@/data/Tasks";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskChecklistDrawer } from "./TaskChecklistDrawer";
import { taskChecklistStore } from "@/lib/taskChecklistStore";

interface Props {
  task: Task;
  onStatusChange: (taskId: string, status: Task["status"]) => void;
}

function getDueDateColor(dueDate: string, status: string) {
  if (status === "completed") return "text-green-600 bg-green-50";
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return "text-red-600 bg-red-50";
  if (days <= 7) return "text-orange-600 bg-orange-50";
  return "text-green-600 bg-green-50";
}

function getPriorityBadge(priority: Task["priority"]) {
  const map: Record<string, { label: string; className: string }> = {
    urgent: { label: "Urgent", className: "bg-destructive text-destructive-foreground" },
    high: { label: "High", className: "bg-orange-500 text-white" },
    medium: { label: "Medium", className: "bg-yellow-500 text-white" },
    low: { label: "Low", className: "bg-muted text-muted-foreground" },
  };
  return map[priority];
}

export function TaskCard({ task, onStatusChange }: Props) {
  const icon = taskTypeIcons[task.taskType] || "⚡";
  const dateColor = getDueDateColor(task.dueDate, task.status);
  const priority = getPriorityBadge(task.priority);
  const [openChecklist, setOpenChecklist] = useState(false);
  const [checklistVersion, setChecklistVersion] = useState(0);
  useEffect(() => {
    const unsub = taskChecklistStore.subscribe(() => setChecklistVersion((v) => v + 1));
    return () => { unsub(); };
  }, []);
  const items = taskChecklistStore.get(task.id);
  const received = items.filter((i) => i.received).length;
  const total = items.length || task.docsTotal;
  const docsReceived = items.length ? received : task.docsReceived;
  void checklistVersion;

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-heading font-semibold text-foreground">{task.taskType}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {task.status !== "pending" && (
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "pending")}>
                Move to Pending
              </DropdownMenuItem>
            )}
            {task.status !== "in_progress" && (
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "in_progress")}>
                Move to In Progress
              </DropdownMenuItem>
            )}
            {task.status !== "completed" && (
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "completed")}>
                Mark Completed
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-sm font-medium text-primary cursor-pointer hover:underline mb-1.5">
        {task.clientName}
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${dateColor}`}>
          {format(parseISO(task.dueDate), "dd/MM/yyyy")}
        </span>
        <Badge className={`text-[10px] ${priority.className} border-0`}>
          {priority.label}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold">
            {task.assignedInitials}
          </div>
          <span className="text-xs text-muted-foreground">{task.assignedTo.split(" ")[0]}</span>
        </div>
        <button
          onClick={() => items.length > 0 && setOpenChecklist(true)}
          className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-primary transition-colors"
          disabled={items.length === 0}
        >
          <ListChecks className="h-3 w-3" /> {docsReceived}/{total} docs
        </button>
      </div>
      {items.length > 0 && (
        <TaskChecklistDrawer
          open={openChecklist}
          onOpenChange={setOpenChecklist}
          taskId={task.id}
          taskName={task.customTaskName || task.taskType}
          clientName={task.clientName}
        />
      )}
    </div>
  );
}
