import { Task } from "@/data/Tasks";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskTypeIcon } from "./TaskTypeIcon";
import { getDueDateTextClass, getStatusBadge } from "@/lib/taskDisplay";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/common/PaginationControls";

interface Props {
  tasks: Task[];
  onStatusChange: (taskId: string, status: Task["status"]) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

// M27, ISSUES.md — paginated locally (not by the parent Tasks.tsx) because
// Tasks.tsx's filteredTasks also feeds TaskKanbanBoard (needs the full set
// to bucket into status columns) and TaskCalendarView (needs the full set
// to bucket into days) — only this flat list actually wants one page at a
// time. Sorted by urgency already (H13), so page 1 is the most overdue work.
export function TaskListView({ tasks, onStatusChange, onEdit, onDelete }: Props) {
  const { paginated, page, setPage, totalPages, totalItems, pageSize } = usePagination(tasks, 25);

  return (
    <div className="space-y-3">
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Docs</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((task) => {
            const statusBadge = getStatusBadge(task.status);
            const dateColor = getDueDateTextClass(task.dueDate, task.status);
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <TaskTypeIcon taskType={task.taskType} />
                    <span className="font-medium text-sm">{task.taskType}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-primary cursor-pointer hover:underline">
                  {task.clientName}
                </TableCell>
                <TableCell className={`text-sm ${dateColor}`}>
                  {format(parseISO(task.dueDate), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">{task.priority}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs border ${statusBadge.className}`}>{statusBadge.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold">
                      {task.assignedInitials}
                    </div>
                    <span className="text-xs">{task.assignedTo.split(" ")[0]}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {task.docsReceived}/{task.docsTotal}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`More actions for ${task.clientName}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(task)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(task)}>Delete</DropdownMenuItem>
                      {task.status !== "pending" && (
                        <DropdownMenuItem onClick={() => onStatusChange(task.id, "pending")}>Move to Pending</DropdownMenuItem>
                      )}
                      {task.status !== "in_progress" && (
                        <DropdownMenuItem onClick={() => onStatusChange(task.id, "in_progress")}>Move to In Progress</DropdownMenuItem>
                      )}
                      {task.status !== "completed" && (
                        <DropdownMenuItem onClick={() => onStatusChange(task.id, "completed")}>Mark Completed</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
