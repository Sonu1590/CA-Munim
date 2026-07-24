import { differenceInDays, parseISO } from "date-fns";
import { Task } from "@/data/Tasks";

// Shared across TaskCard, TaskListView, and the mobile Tasks screen — was
// duplicated (with a slight bg-vs-text-only variation) between the first
// two; extracted rather than adding a third near-identical copy.

export function getDueDateBadgeClasses(dueDate: string, status: string) {
  if (status === "completed") return "text-green-600 bg-green-50";
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return "text-red-600 bg-red-50";
  if (days <= 7) return "text-orange-600 bg-orange-50";
  return "text-green-600 bg-green-50";
}

export function getDueDateTextClass(dueDate: string, status: string) {
  if (status === "completed") return "text-green-600";
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 7) return "text-orange-600";
  return "text-foreground";
}

export function getPriorityBadge(priority: Task["priority"]) {
  const map: Record<string, { label: string; className: string }> = {
    urgent: { label: "Urgent", className: "bg-destructive text-destructive-foreground" },
    high: { label: "High", className: "bg-orange-500 text-white" },
    medium: { label: "Medium", className: "bg-yellow-500 text-white" },
    low: { label: "Low", className: "bg-muted text-muted-foreground" },
  };
  return map[priority];
}

export function getStatusBadge(status: Task["status"]) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-orange-100 text-orange-700 border-orange-200" },
    in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
    completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  };
  return map[status];
}
