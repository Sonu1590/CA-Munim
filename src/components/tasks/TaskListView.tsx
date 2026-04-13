import { Task, taskTypeIcons } from "@/data/mockTasks";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  tasks: Task[];
  onStatusChange: (taskId: string, status: Task["status"]) => void;
}

function getStatusBadge(status: Task["status"]) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-orange-100 text-orange-700 border-orange-200" },
    in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
    completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  };
  return map[status];
}

function getDueDateColor(dueDate: string, status: string) {
  if (status === "completed") return "text-green-600";
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 7) return "text-orange-600";
  return "text-foreground";
}

export function TaskListView({ tasks, onStatusChange }: Props) {
  return (
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
          {tasks.map((task) => {
            const icon = taskTypeIcons[task.taskType] || "⚡";
            const statusBadge = getStatusBadge(task.status);
            const dateColor = getDueDateColor(task.dueDate, task.status);
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
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
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
  );
}
