import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TodayDigest } from "@/components/dashboard/TodayDigest";
import { buildDigestItems } from "@/test/fixtures/dashboard";

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/tasks" element={<div>TASKS_PAGE_SENTINEL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TodayDigest", () => {
  it("shows the caught-up empty state when there is nothing overdue or due today", () => {
    renderWithRouter(<TodayDigest items={[]} />);
    expect(screen.getByText("Nothing due or overdue — you're caught up.")).toBeInTheDocument();
  });

  it("renders overdue items with a destructive icon/label and due-today with a warning label", () => {
    renderWithRouter(
      <TodayDigest
        items={[
          buildDigestItems(1, () => ({ id: "d-overdue", taskType: "GSTR-3B", clientName: "Overdue Co", daysOverdue: 3 }))[0],
          buildDigestItems(1, () => ({ id: "d-today", taskType: "TDS Challan", clientName: "Today Co", daysOverdue: 0 }))[0],
        ]}
      />,
    );

    expect(screen.getByText("3 days overdue")).toBeInTheDocument();
    expect(screen.getByText("3 days overdue")).toHaveClass("text-destructive");
    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("2 items need attention")).toBeInTheDocument();
  });

  it("singularises the overdue-day label at exactly one day", () => {
    renderWithRouter(<TodayDigest items={buildDigestItems(1, () => ({ daysOverdue: 1 }))} />);
    expect(screen.getByText("1 day overdue")).toBeInTheDocument();
  });

  // The exact unbounded-list class the repo cares about: fetchDigest returns up
  // to 50, but the dashboard glance caps the render at 5 and links out for the
  // rest.
  it("caps the list at 5 items and shows a '+N more' link for a 50-item dataset", () => {
    const items = buildDigestItems(50, (i) => ({ clientName: `Digest Client ${i}`, daysOverdue: i + 1 }));
    renderWithRouter(<TodayDigest items={items} />);

    expect(screen.getAllByText(/Digest Client \d+/)).toHaveLength(5);
    expect(screen.queryByText(/Digest Client 10\b/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+45 more — View all in Tasks/ })).toBeInTheDocument();
  });

  it("navigates to /tasks when the 'View all' link is clicked", async () => {
    const items = buildDigestItems(50, (i) => ({ daysOverdue: i + 1 }));
    renderWithRouter(<TodayDigest items={items} />);

    fireEvent.click(screen.getByRole("button", { name: /View all in Tasks/ }));
    expect(await screen.findByText("TASKS_PAGE_SENTINEL")).toBeInTheDocument();
  });

  it("orders overdue items ahead of due-today items", () => {
    // Build a mix: due-today first in the array, overdue second — the
    // component must still surface the overdue one first.
    const items = [
      buildDigestItems(1, () => ({ id: "d-today", clientName: "Today Co", daysOverdue: 0 }))[0],
      buildDigestItems(1, () => ({ id: "d-overdue", clientName: "Overdue Co", daysOverdue: 5 }))[0],
    ];
    renderWithRouter(<TodayDigest items={items} />);

    const rendered = screen.getAllByText(/Co$/).map((el) => el.textContent);
    expect(rendered[0]).toContain("Overdue Co");
  });
});
