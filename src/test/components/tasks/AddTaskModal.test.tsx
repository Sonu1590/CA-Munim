import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { FinancialYearProvider } from "@/context/financialYear";
import { useClients } from "@/hooks/useClients";
import { useStaff } from "@/hooks/useStaff";

vi.mock("@/hooks/useClients");
vi.mock("@/hooks/useStaff");

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

function renderModal() {
  vi.mocked(useClients).mockReturnValue({
    clients: [{ id: "c1", name: "Acme Co" } as any],
    loading: false,
  } as any);
  vi.mocked(useStaff).mockReturnValue({
    staff: [{ id: "s1", name: "Priya" } as any],
    loading: false,
  } as any);

  return render(
    <FinancialYearProvider>
      <AddTaskModal open onOpenChange={() => {}} />
    </FinancialYearProvider>,
  );
}

// M30, ISSUES.md — AddTaskModal previously validated client/taskType/dueDate
// via toast-only, submit-only checks with no inline field marking, and never
// enforced Custom Task Name when Task Type is "Other". These tests cover the
// fixed inline, collect-all-errors behavior.
describe("AddTaskModal", () => {
  it("collects and shows every required-field error at once on submit", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));

    expect(screen.getByText("Client is required.")).toBeInTheDocument();
    expect(screen.getByText("Task Type is required.")).toBeInTheDocument();
    expect(screen.getByText("Due Date is required.")).toBeInTheDocument();
  });

  it("requires Custom Task Name only when Task Type is Other", () => {
    renderModal();

    fireEvent.click(screen.getByRole("combobox", { name: /Task Type/i }));
    fireEvent.click(screen.getByText("Other"));
    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));

    expect(screen.getByText("Custom Task Name is required when Task Type is Other.")).toBeInTheDocument();
  });
});
