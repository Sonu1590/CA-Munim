import { Task, ChecklistItem } from "@/data/Tasks";
import { TaskCard } from "./TaskCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  tasks: Task[];
  onStatusChange: (taskId: string, status: Task["status"]) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onChecklistUpdate: (taskId: string, items: ChecklistItem[]) => void | Promise<void>;
  /** M27, ISSUES.md — switches the parent Tasks page to List view, so
   * "+N more" has somewhere real to send the user for the rest of a
   * column. List view is paginated and sorted by urgency (H13). */
  onViewAll: () => void;
}

const columns: { key: Task["status"]; label: string; short: string; color: string }[] = [
  { key: "pending", label: "Pending", short: "Pending", color: "bg-orange-500" },
  { key: "in_progress", label: "In Progress", short: "In Progress", color: "bg-blue-500" },
  { key: "completed", label: "Completed / Filed", short: "Done", color: "bg-green-500" },
];

// M27, ISSUES.md — a 3-column board doesn't map to single-page-number
// pagination the way a flat list does, so each column caps at a fixed
// count instead, same "cap + view all" shape as TodayDigest, with the
// same rationale: this is a glance surface (a card in a column is a
// summary of the task, not the only place it's browsable) — List view
// is the full, paginated, sortable view of the same data.
const COLUMN_VISIBLE_LIMIT = 20;

function Column({
  col,
  tasks,
  onStatusChange,
  onEdit,
  onDelete,
  onChecklistUpdate,
  onViewAll,
}: {
  col: (typeof columns)[number];
  tasks: Task[];
  onStatusChange: Props["onStatusChange"];
  onEdit?: Props["onEdit"];
  onDelete?: Props["onDelete"];
  onChecklistUpdate: Props["onChecklistUpdate"];
  onViewAll: Props["onViewAll"];
}) {
  const visible = tasks.slice(0, COLUMN_VISIBLE_LIMIT);
  const hiddenCount = tasks.length - visible.length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
        <h3 className="text-sm font-heading font-semibold text-foreground">{col.label}</h3>
        <span className="ml-auto text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 bg-muted/30 rounded-xl p-3 min-h-[200px]">
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
        )}
        {visible.map((task) => (
          <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} onChecklistUpdate={onChecklistUpdate} />
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-primary hover:underline text-center py-2"
          >
            +{hiddenCount} more — View all in List
          </button>
        )}
      </div>
    </div>
  );
}

export function TaskKanbanBoard({ tasks, onStatusChange, onEdit, onDelete, onChecklistUpdate, onViewAll }: Props) {
  const byStatus = (s: Task["status"]) => tasks.filter((t) => t.status === s);

  return (
    <>
      {/* Desktop & tablet: 3-column board */}
      <div className="hidden md:grid grid-cols-3 gap-4">
        {columns.map((col) => (
          <Column key={col.key} col={col} tasks={byStatus(col.key)} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} onChecklistUpdate={onChecklistUpdate} onViewAll={onViewAll} />
        ))}
      </div>

      {/* Mobile: tabs to switch between columns (single-column view) */}
      <div className="md:hidden">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            {columns.map((col) => {
              const count = byStatus(col.key).length;
              return (
                <TabsTrigger key={col.key} value={col.key} className="text-xs gap-1.5 py-2">
                  <span className={`h-2 w-2 rounded-full ${col.color}`} />
                  <span>{col.short}</span>
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {columns.map((col) => (
            <TabsContent key={col.key} value={col.key} className="mt-3">
              <Column col={col} tasks={byStatus(col.key)} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} onChecklistUpdate={onChecklistUpdate} onViewAll={onViewAll} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}
