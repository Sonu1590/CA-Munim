import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDueDateBadgeClasses,
  getDueDateTextClass,
  getPriorityBadge,
  getStatusBadge,
} from "@/lib/taskDisplay";

// getDueDateBadgeClasses/getDueDateTextClass compare the due date against
// `new Date()`, so pin "now" to a fixed local midnight to make the day-diff
// boundaries deterministic regardless of the machine timezone.
describe("taskDisplay due-date colouring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("always treats completed tasks as green regardless of due date", () => {
    // Even a long-overdue date is green once the task is completed.
    expect(getDueDateBadgeClasses("2026-01-01", "completed")).toBe("text-green-600 bg-green-50");
    expect(getDueDateTextClass("2026-01-01", "completed")).toBe("text-green-600");
  });

  it("flags a past due date as red for a non-completed task", () => {
    expect(getDueDateBadgeClasses("2026-06-10", "pending")).toBe("text-red-600 bg-red-50");
    expect(getDueDateTextClass("2026-06-10", "pending")).toBe("text-red-600 font-semibold");
  });

  it("flags a due date within the next 7 days as orange", () => {
    // 2026-06-22 is exactly 7 days out — the inclusive upper edge.
    expect(getDueDateBadgeClasses("2026-06-22", "in_progress")).toBe("text-orange-600 bg-orange-50");
    expect(getDueDateTextClass("2026-06-16", "in_progress")).toBe("text-orange-600");
  });

  it("treats a due date more than 7 days out as green/neutral", () => {
    // 2026-06-23 is 8 days out — just past the orange window.
    expect(getDueDateBadgeClasses("2026-06-23", "pending")).toBe("text-green-600 bg-green-50");
    expect(getDueDateTextClass("2026-06-23", "pending")).toBe("text-foreground");
  });

  it("treats today (0 days out) as within the orange window, not overdue", () => {
    expect(getDueDateBadgeClasses("2026-06-15", "pending")).toBe("text-orange-600 bg-orange-50");
  });
});

describe("getPriorityBadge", () => {
  it("maps every priority to a distinct label and class", () => {
    expect(getPriorityBadge("urgent")).toEqual({
      label: "Urgent",
      className: "bg-destructive text-destructive-foreground",
    });
    expect(getPriorityBadge("high").label).toBe("High");
    expect(getPriorityBadge("medium").label).toBe("Medium");
    expect(getPriorityBadge("low").label).toBe("Low");
  });

  it("returns undefined for an unknown priority rather than throwing", () => {
    expect(getPriorityBadge("bogus" as never)).toBeUndefined();
  });
});

describe("getStatusBadge", () => {
  it("maps each task status to its badge", () => {
    expect(getStatusBadge("pending").label).toBe("Pending");
    expect(getStatusBadge("in_progress").label).toBe("In Progress");
    expect(getStatusBadge("completed").label).toBe("Completed");
  });
});
