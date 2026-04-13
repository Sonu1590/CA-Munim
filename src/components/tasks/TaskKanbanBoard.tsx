import { Task } from "@/data/mockTasks";
import { TaskCard } from "./TaskCard";

interface Props {
  tasks: Task[];
  onStatusChange: (taskId: string, status: Task["status"]) => void;
}

const columns: { key: Task["status"]; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "bg-orange-500" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "completed", label: "Completed / Filed", color: "bg-green-500" },
];

export function TaskKanbanBoard({ tasks, onStatusChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
              <h3 className="text-sm font-heading font-semibold text-foreground">{col.label}</h3>
              <span className="ml-auto text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-3 bg-muted/30 rounded-xl p-3 min-h-[200px]">
              {colTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
              )}
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
