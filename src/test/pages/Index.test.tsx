import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "@/pages/Index";
import { useDashboard } from "@/hooks/useDashboard";
import { FinancialYearProvider } from "@/context/financialYear";

vi.mock("@/hooks/useDashboard", () => ({
  useDashboard: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

const mockUseDashboard = vi.mocked(useDashboard);

describe("Dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while dashboard data is loading", () => {
    mockUseDashboard.mockReturnValue({
      metrics: { totalClients: 0, overdueTasks: 0, pendingFees: 0, dueThisWeek: 0 },
      complianceAlerts: [],
      digest: [],
      activity: [],
      monthlyWork: { completed: 0, total: 0, byType: [] },
      loading: true,
      firmName: "",
      caName: "",
      refetch: vi.fn(),
    });

    render(<MemoryRouter><FinancialYearProvider><Dashboard /></FinancialYearProvider></MemoryRouter>);

    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
    expect(screen.queryByText("Total Clients")).not.toBeInTheDocument();
  });

  it("renders populated metrics, alerts, activity, monthly work, and quick actions", () => {
    mockUseDashboard.mockReturnValue({
      metrics: {
        totalClients: 18,
        overdueTasks: 3,
        pendingFees: 125000,
        dueThisWeek: 7,
      },
      complianceAlerts: [
        {
          id: "GSTR-3B::2026-05-20",
          filingType: "GSTR-3B",
          dueDate: "2026-05-20",
          clientsAffected: 4,
          daysUntilDue: 6,
          urgency: "upcoming",
        },
        {
          id: "TDS Challan::2026-05-01",
          filingType: "TDS Challan",
          dueDate: "2026-05-01",
          clientsAffected: 1,
          daysUntilDue: -11,
          urgency: "overdue",
        },
      ],
      digest: [
        {
          id: "task-1",
          taskType: "GSTR-3B",
          clientId: "client-1",
          clientName: "Mock Client",
          dueDate: "2026-05-01",
          daysOverdue: 3,
        },
        {
          id: "task-2",
          taskType: "TDS Challan",
          clientId: "client-2",
          clientName: "Another Client",
          dueDate: "2026-05-04",
          daysOverdue: 0,
        },
      ],
      activity: [
        {
          id: "inv-1",
          description: "Invoice INV-001 sent to Mock Client - Rs. 1,25,000",
          timestamp: new Date().toISOString(),
          type: "invoice",
        },
        {
          id: "doc-1",
          description: "Document received from Mock Client: bank-statement.pdf",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          type: "document",
        },
      ],
      monthlyWork: {
        completed: 8,
        total: 10,
        byType: [
          { name: "GST", count: 5 },
          { name: "ITR", count: 3 },
        ],
      },
      loading: false,
      firmName: "Demo Firm",
      caName: "R Sharma",
      refetch: vi.fn(),
    });

    render(<MemoryRouter><FinancialYearProvider><Dashboard /></FinancialYearProvider></MemoryRouter>);

    const desktop = within(screen.getByTestId("desktop-dashboard"));

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Welcome back, CA R Sharma")).toBeInTheDocument();

    expect(desktop.getByText("18")).toBeInTheDocument();
    expect(desktop.getByText("3")).toBeInTheDocument();
    expect(desktop.getAllByText(/1,25,000/)).toHaveLength(2);
    expect(desktop.getByText("7")).toBeInTheDocument();

    expect(desktop.getAllByText("GSTR-3B")).toHaveLength(2); // compliance alert card + digest item
    expect(desktop.getAllByText("TDS Challan")).toHaveLength(2);
    expect(desktop.getByText("11 days overdue")).toBeInTheDocument();
    expect(desktop.getByText("4 clients affected")).toBeInTheDocument();

    expect(desktop.getByText("2 items need attention")).toBeInTheDocument();
    expect(desktop.getByText((_, el) => el?.textContent === "GSTR-3B for Mock Client")).toBeInTheDocument();
    expect(desktop.getByText((_, el) => el?.textContent === "TDS Challan for Another Client")).toBeInTheDocument();
    expect(desktop.getByText("3 days overdue")).toBeInTheDocument();
    expect(desktop.getByText("Due today")).toBeInTheDocument();

    expect(desktop.getByText("Invoice INV-001 sent to Mock Client - Rs. 1,25,000")).toBeInTheDocument();
    expect(desktop.getByText("Document received from Mock Client: bank-statement.pdf")).toBeInTheDocument();
    expect(desktop.getByText("8/10 (80%)")).toBeInTheDocument();

    expect(desktop.getByRole("button", { name: /Add New Client/i })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: /Bulk WhatsApp Reminder/i })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: /Create Task/i })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: /Generate Invoice/i })).toBeInTheDocument();

    // Mobile Home tree renders the same real data in its own layout.
    const mobile = within(screen.getByTestId("mobile-home"));
    expect(mobile.getByText("CA Munim")).toBeInTheDocument();
    expect(mobile.getByText("18")).toBeInTheDocument();
    expect(mobile.getByText("₹1,25,000")).toBeInTheDocument();
    expect(mobile.getByText("Mock Client")).toBeInTheDocument();
    expect(mobile.getByText("Another Client")).toBeInTheDocument();
    expect(mobile.getAllByRole("button", { name: /Nudge on WhatsApp/i })).toHaveLength(2);
    expect(mobile.getAllByRole("button", { name: /Mark filed/i })).toHaveLength(2);
  });

  it("renders useful empty states when there is no dashboard data", () => {
    mockUseDashboard.mockReturnValue({
      metrics: { totalClients: 0, overdueTasks: 0, pendingFees: 0, dueThisWeek: 0 },
      complianceAlerts: [],
      digest: [],
      activity: [],
      monthlyWork: { completed: 0, total: 0, byType: [] },
      loading: false,
      firmName: "",
      caName: "",
      refetch: vi.fn(),
    });

    render(<MemoryRouter><FinancialYearProvider><Dashboard /></FinancialYearProvider></MemoryRouter>);

    expect(screen.getByText("Welcome back, CA")).toBeInTheDocument();
    expect(screen.getByText("Nothing due or overdue — you're caught up.")).toBeInTheDocument();
    expect(screen.getByText("No upcoming compliance deadlines in the next 30 days.")).toBeInTheDocument();
    expect(screen.getByText("No recent activity yet. Start by adding clients and creating tasks.")).toBeInTheDocument();
    expect(screen.getByText("No tasks this month")).toBeInTheDocument();
    expect(screen.getByText("No task data for this month yet.")).toBeInTheDocument();
  });
});
