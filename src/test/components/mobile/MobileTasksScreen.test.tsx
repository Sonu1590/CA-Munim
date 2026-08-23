import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTasksScreen } from "@/components/mobile/MobileTasksScreen";

type Status = "pending" | "in_progress" | "completed";
type Priority = "low" | "medium" | "high" | "urgent";

interface MobileTask {
  id: string;
  clientName: string;
  taskType: string;
  customTaskName?: string;
  period?: string;
  dueDate: string;
  priority: Priority;
  status: Status;
}

function task(overrides: Partial<MobileTask> = {}): MobileTask {
  return {
    id: "task-1",
    clientName: "Amit Traders",
    taskType: "GSTR-3B",
    dueDate: "2026-06-01",
    priority: "medium",
    status: "pending",
    ...overrides,
  };
}

// "fixed object + overrides, generalized to a count" convention — the same
// pattern fixtures/dashboard.ts uses, so a large list is built by a factory
// rather than hand-typed.
function buildTasks(n: number, overrides: (i: number) => Partial<MobileTask> = () => ({})): MobileTask[] {
  return Array.from({ length: n }, (_, i) =>
    task({ id: `task-${i}`, clientName: `Task Client ${String(i).padStart(3, "0")}`, ...overrides(i) }),
  );
}

const stats = { total: 10, pending: 4, overdue: 5 };

describe("MobileTasksScreen", () => {
  beforeEach(() => {
    // getDueDateBadgeClasses compares dueDate against now; pin it so the
    // severity classes are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the overdue stat in red", () => {
    render(<MobileTasksScreen tasks={[task()]} stats={stats} onStatusChange={vi.fn()} />);

    const overdue = screen.getByText("5 overdue");
    expect(overdue).toHaveClass("text-red-600");
    expect(overdue).toHaveClass("font-bold");
  });

  it("shows only tasks matching the active status segment and switches on tap", () => {
    const tasks = [
      task({ id: "p", clientName: "Pending Client", status: "pending" }),
      task({ id: "c", clientName: "Done Client", status: "completed" }),
    ];
    render(<MobileTasksScreen tasks={tasks} stats={stats} onStatusChange={vi.fn()} />);

    // Default segment is "Pending".
    expect(screen.getByText("Pending Client")).toBeInTheDocument();
    expect(screen.queryByText("Done Client")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByText("Pending Client")).not.toBeInTheDocument();
    expect(screen.getByText("Done Client")).toBeInTheDocument();
  });

  it("marks the active segment button with the accent treatment", () => {
    render(<MobileTasksScreen tasks={[task()]} stats={stats} onStatusChange={vi.fn()} />);

    const pendingSeg = screen.getByRole("button", { name: "Pending" });
    const doneSeg = screen.getByRole("button", { name: "Done" });
    expect(pendingSeg).toHaveClass("bg-mobile-accent");
    expect(pendingSeg).toHaveClass("text-white");
    expect(doneSeg).not.toHaveClass("bg-mobile-accent");
  });

  it("toggles a pending task to completed via the checkbox", () => {
    const onStatusChange = vi.fn();
    render(<MobileTasksScreen tasks={[task({ id: "t9", status: "pending" })]} stats={stats} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Mark as completed" }));

    expect(onStatusChange).toHaveBeenCalledWith("t9", "completed");
  });

  it("toggles a completed task back to pending via the checkbox", () => {
    const onStatusChange = vi.fn();
    render(
      <MobileTasksScreen
        tasks={[task({ id: "t9", status: "completed" })]}
        stats={stats}
        onStatusChange={onStatusChange}
      />,
    );

    // Completed tasks are only visible under the "Done" segment.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark as pending" }));

    expect(onStatusChange).toHaveBeenCalledWith("t9", "pending");
  });

  it("colours an overdue pending task's due-date badge red", () => {
    // Due 2026-06-01 with 'now' pinned to 2026-06-15 -> overdue.
    render(<MobileTasksScreen tasks={[task({ dueDate: "2026-06-01", status: "pending" })]} stats={stats} onStatusChange={vi.fn()} />);

    const badge = screen.getByText("01/06");
    expect(badge).toHaveClass("text-red-600");
    expect(badge).toHaveClass("bg-red-50");
  });

  it("colours a due-soon pending task's badge amber", () => {
    // Due 2026-06-18 is within 7 days of the pinned 'now' -> upcoming/amber.
    render(<MobileTasksScreen tasks={[task({ dueDate: "2026-06-18", status: "pending" })]} stats={stats} onStatusChange={vi.fn()} />);

    const badge = screen.getByText("18/06");
    expect(badge).toHaveClass("text-orange-600");
    expect(badge).toHaveClass("bg-orange-50");
  });

  it("renders the task's priority badge label", () => {
    render(<MobileTasksScreen tasks={[task({ priority: "urgent" })]} stats={stats} onStatusChange={vi.fn()} />);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("shows the empty state when the active segment has no tasks", () => {
    render(<MobileTasksScreen tasks={[task({ status: "completed" })]} stats={stats} onStatusChange={vi.fn()} />);
    // Default 'Pending' segment is empty since the only task is completed.
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("bounds a large pending list to one page of 25 and paginates the rest", () => {
    render(
      <MobileTasksScreen tasks={buildTasks(30, () => ({ status: "pending" }))} stats={stats} onStatusChange={vi.fn()} />,
    );

    expect(screen.getByText("Task Client 000")).toBeInTheDocument();
    expect(screen.getByText("Task Client 024")).toBeInTheDocument();
    expect(screen.queryByText("Task Client 025")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 30")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(screen.queryByText("Task Client 000")).not.toBeInTheDocument();
    expect(screen.getByText("Task Client 025")).toBeInTheDocument();
    expect(screen.getByText("Task Client 029")).toBeInTheDocument();
    expect(screen.getByText("Showing 26–30 of 30")).toBeInTheDocument();
  });

  it("paginates within the active tab, not across all tasks", () => {
    // 30 pending + 30 completed. The Pending tab must page over 30, not 60.
    const mixed = [
      ...buildTasks(30, () => ({ status: "pending" })),
      ...buildTasks(30, (i) => ({ id: `done-${i}`, clientName: `Done Client ${i}`, status: "completed" })),
    ];
    render(<MobileTasksScreen tasks={mixed} stats={stats} onStatusChange={vi.fn()} />);

    expect(screen.getByText("Showing 1–25 of 30")).toBeInTheDocument();
  });
});
