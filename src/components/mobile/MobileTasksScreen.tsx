import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import { getDueDateBadgeClasses, getPriorityBadge } from "@/lib/taskDisplay";

interface MobileTask {
  id: string;
  clientName: string;
  taskType: string;
  customTaskName?: string;
  period?: string;
  dueDate: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed";
}

interface MobileTasksScreenProps {
  tasks: MobileTask[];
  stats: { total: number; pending: number; overdue: number };
  onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
}

const segments = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Done" },
] as const;

export function MobileTasksScreen({ tasks, stats, onStatusChange }: MobileTasksScreenProps) {
  const [statusFilter, setStatusFilter] = useState<(typeof segments)[number]["value"]>("pending");

  const visibleTasks = tasks.filter((t) => t.status === statusFilter);

  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-8 min-h-[calc(100vh-8rem)]">
      <span className="font-mobile-heading font-normal text-2xl block mb-1">Tasks</span>
      <p className="text-xs text-mobile-neutral-600 mb-3.5">
        {stats.total} total · {stats.pending} pending · <span className="text-mobile-accent-700 font-bold">{stats.overdue} overdue</span>
      </p>

      <div className="flex bg-mobile-surface rounded-full p-1 mb-4">
        {segments.map((seg) => (
          <button
            key={seg.value}
            onClick={() => setStatusFilter(seg.value)}
            className={`flex-1 rounded-full py-2 text-xs font-bold ${
              statusFilter === seg.value ? "bg-mobile-accent text-white shadow-mobile-sm" : "text-mobile-neutral-700"
            }`}
          >
            {seg.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {visibleTasks.map((task) => {
          const priority = getPriorityBadge(task.priority);
          const checked = task.status === "completed";
          return (
            <div key={task.id} className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm flex items-center gap-3">
              <button
                onClick={() => onStatusChange(task.id, checked ? "pending" : "completed")}
                aria-label={checked ? "Mark as pending" : "Mark as completed"}
                className={`shrink-0 w-6.5 h-6.5 rounded-full border-2 flex items-center justify-center ${
                  checked ? "bg-mobile-accent-2 border-mobile-accent-2" : "border-mobile-neutral-400 bg-transparent"
                }`}
              >
                {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm ${checked ? "line-through text-mobile-neutral-500" : ""}`}>
                  {task.customTaskName || task.taskType}
                </div>
                <div className="text-xs text-mobile-neutral-600">
                  {task.clientName}
                  {task.period ? ` · ${task.period}` : ""}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getDueDateBadgeClasses(task.dueDate, task.status)}`}>
                  {format(parseISO(task.dueDate), "dd/MM")}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${priority.className}`}>
                  {priority.label}
                </span>
              </div>
            </div>
          );
        })}
        {visibleTasks.length === 0 && (
          <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600">Nothing here.</div>
        )}
      </div>
    </div>
  );
}
