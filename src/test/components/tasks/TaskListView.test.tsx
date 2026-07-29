import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Task } from "@/data/Tasks";

// M27, ISSUES.md — same "fixed object + overrides, generalized to also
// take a count" convention as fixtures/dashboard.ts's buildDigestItems.
function buildTasks(n: number): Task[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `bulk-task-${i}`,
    clientName: `Bulk Client ${String(i).padStart(3, "0")}`,
    clientId: `client-${i}`,
    taskType: "GST Filing",
    financialYear: "FY 2025-26",
    dueDate: "2026-08-01",
    priority: "medium",
    status: "pending",
    assignedTo: "Test Staff",
    assignedInitials: "TS",
    docsReceived: 0,
    docsTotal: 0,
  })) as Task[];
}

describe("TaskListView", () => {
  it("bounds a firm-scale (60 task) list to one page of 25 with working pagination", () => {
    render(
      <TooltipProvider>
        <TaskListView tasks={buildTasks(60)} onStatusChange={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />
      </TooltipProvider>,
    );

    expect(screen.getByText("Bulk Client 000")).toBeInTheDocument();
    expect(screen.getByText("Bulk Client 024")).toBeInTheDocument();
    expect(screen.queryByText("Bulk Client 025")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(screen.queryByText("Bulk Client 000")).not.toBeInTheDocument();
    expect(screen.getByText("Bulk Client 025")).toBeInTheDocument();
    expect(screen.getByText("Bulk Client 049")).toBeInTheDocument();
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
  });

  it("renders without pagination controls for a small list", () => {
    render(
      <TooltipProvider>
        <TaskListView tasks={buildTasks(3)} onStatusChange={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />
      </TooltipProvider>,
    );

    expect(screen.getByText("Bulk Client 000")).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
});
