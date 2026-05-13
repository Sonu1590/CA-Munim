import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Tasks from "@/pages/Tasks";
import { useTasks } from "@/hooks/useTasks";

vi.mock("@/hooks/useTasks", () => ({
  useTasks: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");
  const TabsContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
      className,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
      className?: string;
    }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div className={className}>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    TabsTrigger: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button
          type="button"
          role="tab"
          aria-selected={ctx.value === value}
          className={className}
          onClick={() => ctx.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      return ctx.value === value ? <div className={className}>{children}</div> : null;
    },
  };
});

vi.mock("@/components/tasks/TaskKanbanBoard", () => ({
  TaskKanbanBoard: ({
    tasks,
    onStatusChange,
  }: {
    tasks: any[];
    onStatusChange: (taskId: string, status: "pending" | "in_progress" | "completed") => void;
  }) => (
    <div data-testid="kanban-view">
      {tasks.map((task) => (
        <div key={task.id}>
          <span>{task.taskType}</span>
          <span>{task.clientName}</span>
          <span>{task.assignedTo}</span>
          <span>
            Docs {task.docsReceived}/{task.docsTotal}
          </span>
          <button type="button" onClick={() => onStatusChange(task.id, "completed")}>
            Complete {task.taskType}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/tasks/TaskListView", () => ({
  TaskListView: ({ tasks }: { tasks: any[] }) => (
    <div data-testid="list-view">
      List view: {tasks.map((task) => task.taskType).join(", ")}
    </div>
  ),
}));

vi.mock("@/components/tasks/TaskCalendarView", () => ({
  TaskCalendarView: ({ tasks }: { tasks: any[] }) => (
    <div data-testid="calendar-view">
      Calendar view: {tasks.map((task) => task.clientName).join(", ")}
    </div>
  ),
}));

vi.mock("@/components/tasks/AddTaskModal", () => ({
  AddTaskModal: ({
    open,
    onOpenChange,
    onSave,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave?: () => Promise<void>;
  }) =>
    open ? (
      <div role="dialog" aria-label="Add New Task">
        <button type="button" onClick={() => onOpenChange(false)}>
          Close add task
        </button>
        <button type="button" onClick={() => onSave?.()}>
          Save task
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/tasks/BulkTaskGenerator", () => ({
  BulkTaskGenerator: ({
    open,
    onOpenChange,
    onGenerated,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerated?: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Bulk Generate Tasks">
        <button type="button" onClick={() => onOpenChange(false)}>
          Close bulk
        </button>
        <button type="button" onClick={onGenerated}>
          Generate mock tasks
        </button>
      </div>
    ) : null,
}));

const mockUseTasks = vi.mocked(useTasks);

const tasks = [
  {
    id: "task-1",
    clientId: "client-1",
    clientName: "Mock Client Pvt Ltd",
    taskType: "GSTR-3B",
    customName: undefined,
    financialYear: "FY 2025-26",
    period: "April",
    dueDate: "2000-01-01",
    status: "pending",
    priority: "urgent",
    assignedTo: "staff-1",
    assignedToName: "Priya Verma",
    documentChecklist: [
      { label: "Sales invoices", checked: true },
      { label: "Purchase invoices", checked: false },
    ],
    notes: "Urgent GST task",
    createdAt: "2026-05-01",
  },
  {
    id: "task-2",
    clientId: "client-2",
    clientName: "Asha Sharma",
    taskType: "ITR Filing",
    customName: undefined,
    financialYear: "FY 2025-26",
    period: "Annual",
    dueDate: "2099-01-01",
    status: "in_progress",
    priority: "medium",
    assignedTo: undefined,
    assignedToName: undefined,
    documentChecklist: [{ label: "Form 16", received: true }],
    notes: "",
    createdAt: "2026-05-02",
  },
] as any[];

function mockTasksState(overrides: Partial<ReturnType<typeof useTasks>> = {}) {
  const state = {
    tasks,
    loading: false,
    error: null,
    overdueCount: 1,
    dueThisWeek: 0,
    addTask: vi.fn(),
    updateTask: vi.fn(),
    updateTaskStatus: vi.fn().mockResolvedValue(true),
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  mockUseTasks.mockReturnValue(state as ReturnType<typeof useTasks>);
  return state;
}

describe("Tasks page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while tasks are loading", () => {
    mockTasksState({ tasks: [], loading: true });

    render(<Tasks />);

    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tasks & Deadlines" })).not.toBeInTheDocument();
  });

  it("shows an error state and retries through refetch", () => {
    const refetch = vi.fn();
    mockTasksState({ tasks: [], error: "Unable to load tasks", refetch });

    render(<Tasks />);

    expect(screen.getByText("Unable to load tasks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders an empty state and opens the add-task modal", () => {
    mockTasksState({ tasks: [] });

    render(<Tasks />);

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add First Task/i }));
    expect(screen.getByRole("dialog", { name: "Add New Task" })).toBeInTheDocument();
  });

  it("renders task stats and normalises task data for the kanban view", () => {
    mockTasksState();

    render(<Tasks />);

    expect(screen.getByRole("heading", { name: "Tasks & Deadlines" })).toBeInTheDocument();
    expect(screen.getByText(/2 total/)).toBeInTheDocument();
    expect(screen.getByText(/1 pending/)).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-view")).toBeInTheDocument();
    expect(screen.getByText("GSTR-3B")).toBeInTheDocument();
    expect(screen.getByText("Mock Client Pvt Ltd")).toBeInTheDocument();
    expect(screen.getByText("Priya Verma")).toBeInTheDocument();
    expect(screen.getByText("Docs 1/2")).toBeInTheDocument();
    expect(screen.getByText("Docs 1/1")).toBeInTheDocument();
  });

  it("filters tasks by search text", () => {
    mockTasksState();

    render(<Tasks />);

    fireEvent.change(screen.getByPlaceholderText("Search tasks or clients..."), {
      target: { value: "asha" },
    });

    expect(screen.queryByText("Mock Client Pvt Ltd")).not.toBeInTheDocument();
    expect(screen.getByText("Asha Sharma")).toBeInTheDocument();
    expect(screen.getByText("ITR Filing")).toBeInTheDocument();
  });

  it("switches between list and calendar views", async () => {
    mockTasksState();

    render(<Tasks />);

    const listTab = screen.getByRole("tab", { name: /List/i });
    fireEvent.pointerDown(listTab, { button: 0, ctrlKey: false });
    fireEvent.click(listTab);
    await waitFor(() => expect(screen.getByTestId("list-view")).toHaveTextContent("GSTR-3B, ITR Filing"));

    const calendarTab = screen.getByRole("tab", { name: /Calendar/i });
    fireEvent.pointerDown(calendarTab, { button: 0, ctrlKey: false });
    fireEvent.click(calendarTab);
    await waitFor(() => expect(screen.getByTestId("calendar-view")).toHaveTextContent("Mock Client Pvt Ltd, Asha Sharma"));
  });

  it("passes status changes to updateTaskStatus", () => {
    const updateTaskStatus = vi.fn().mockResolvedValue(true);
    mockTasksState({ updateTaskStatus });

    render(<Tasks />);

    fireEvent.click(screen.getByRole("button", { name: "Complete GSTR-3B" }));
    expect(updateTaskStatus).toHaveBeenCalledWith("task-1", "completed");
  });

  it("opens bulk generator and refreshes after generated tasks", () => {
    const refetch = vi.fn();
    mockTasksState({ refetch });

    render(<Tasks />);

    fireEvent.click(screen.getByRole("button", { name: /Bulk Generate/i }));
    expect(screen.getByRole("dialog", { name: "Bulk Generate Tasks" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate mock tasks" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
