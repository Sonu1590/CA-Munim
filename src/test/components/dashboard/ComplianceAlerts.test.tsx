import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ComplianceAlerts } from "@/components/dashboard/ComplianceAlerts";

type Urgency = "safe" | "upcoming" | "overdue";
interface Alert {
  id: string;
  filingType: string;
  dueDate: string;
  clientsAffected: number;
  daysUntilDue: number;
  urgency: Urgency;
}

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "GSTR-3B::2026-06-20",
    filingType: "GSTR-3B",
    dueDate: "2026-06-20",
    clientsAffected: 4,
    daysUntilDue: 6,
    urgency: "upcoming",
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/whatsapp" element={<div>WHATSAPP_BULK_SENTINEL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ComplianceAlerts", () => {
  it("shows the empty state when there are no alerts", () => {
    renderWithRouter(<ComplianceAlerts alerts={[]} />);
    expect(screen.getByText("No upcoming compliance deadlines in the next 30 days.")).toBeInTheDocument();
  });

  it("renders each alert's filing type, due date and clients-affected count", () => {
    renderWithRouter(<ComplianceAlerts alerts={[alert({ clientsAffected: 4 })]} />);

    expect(screen.getByText("GSTR-3B")).toBeInTheDocument();
    expect(screen.getByText("4 clients affected")).toBeInTheDocument();
    expect(screen.getByText(/Due: 20\/06\/2026/)).toBeInTheDocument();
  });

  it("singularises the clients-affected label at exactly one client", () => {
    renderWithRouter(<ComplianceAlerts alerts={[alert({ clientsAffected: 1 })]} />);
    expect(screen.getByText("1 client affected")).toBeInTheDocument();
  });

  it("shows the overdue days line only for a past-due alert", () => {
    renderWithRouter(
      <ComplianceAlerts
        alerts={[alert({ id: "a", daysUntilDue: -11, urgency: "overdue" })]}
      />,
    );
    const overdueLine = screen.getByText("11 days overdue");
    expect(overdueLine).toBeInTheDocument();
    expect(overdueLine).toHaveClass("text-destructive");
  });

  it("applies the destructive status style to an overdue card and warning to an upcoming one", () => {
    renderWithRouter(
      <ComplianceAlerts
        alerts={[
          alert({ id: "over", filingType: "TDS Challan", daysUntilDue: -3, urgency: "overdue" }),
          alert({ id: "soon", filingType: "GSTR-1", daysUntilDue: 20, urgency: "upcoming" }),
        ]}
      />,
    );

    // The card is the nearest ancestor carrying the border/bg status class.
    const overdueCard = screen.getByText("TDS Challan").closest("div.border");
    expect(overdueCard?.className).toContain("border-destructive/30");
    // daysUntilDue 20 (>7, <=30) maps to the "upcoming" warning treatment.
    const upcomingCard = screen.getByText("GSTR-1").closest("div.border");
    expect(upcomingCard?.className).toContain("border-warning/30");
  });

  // M37/C6: "Send Reminder" is a real action — it deep-links to the bulk
  // WhatsApp sender, not a dead button.
  it("navigates to the bulk WhatsApp sender when 'Send Reminder' is clicked", async () => {
    renderWithRouter(<ComplianceAlerts alerts={[alert()]} />);

    const button = screen.getByRole("button", { name: /Send Reminder/ });
    fireEvent.click(button);

    expect(await screen.findByText("WHATSAPP_BULK_SENTINEL")).toBeInTheDocument();
  });

  it("renders a Send Reminder button per alert for a multi-alert dataset", () => {
    const alerts = Array.from({ length: 6 }, (_, i) =>
      alert({ id: `a-${i}`, filingType: `TYPE-${i}`, dueDate: `2026-06-${String(i + 10).padStart(2, "0")}` }),
    );
    renderWithRouter(<ComplianceAlerts alerts={alerts} />);

    expect(screen.getAllByRole("button", { name: /Send Reminder/ })).toHaveLength(6);
  });
});
