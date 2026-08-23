import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MobileHomeScreen } from "@/components/mobile/MobileHomeScreen";
import { FinancialYearProvider } from "@/context/financialYear";
import { buildDigestItems } from "@/test/fixtures/dashboard";
import type { ComplianceAlert, DashboardMetrics } from "@/hooks/useDashboard";

// MobileHomeScreen calls useClients/useTasks for its action handlers and mounts
// heavy modals; mock those so the test is about the M36 render, not the modals.
vi.mock("@/hooks/useClients", () => ({ useClients: () => ({ addClient: vi.fn() }) }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: () => ({ addTask: vi.fn(), updateTaskStatus: vi.fn() }) }));
vi.mock("@/components/clients/AddClientModal", () => ({ AddClientModal: () => null }));
vi.mock("@/components/tasks/AddTaskModal", () => ({ AddTaskModal: () => null }));
vi.mock("@/components/billing/CreateInvoiceModal", () => ({ CreateInvoiceModal: () => null }));
vi.mock("@/components/whatsapp/BulkSender", () => ({ BulkSender: () => null }));

const metrics: DashboardMetrics = {
  totalClients: 18,
  overdueTasks: 3,
  pendingFees: 125000,
  dueThisWeek: 7,
};

function alert(overrides: Partial<ComplianceAlert> = {}): ComplianceAlert {
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

function renderHome(props: Partial<React.ComponentProps<typeof MobileHomeScreen>> = {}) {
  const merged = {
    metrics,
    complianceAlerts: [] as ComplianceAlert[],
    digest: [],
    caName: "R Sharma",
    refetch: vi.fn(),
    ...props,
  };
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <FinancialYearProvider>
        <Routes>
          <Route path="/" element={<MobileHomeScreen {...merged} />} />
          <Route path="/tasks" element={<div>TASKS_PAGE_SENTINEL</div>} />
        </Routes>
      </FinancialYearProvider>
    </MemoryRouter>,
  );
}

describe("MobileHomeScreen", () => {
  it("renders the header, greeting and metric values", () => {
    renderHome();

    expect(screen.getByText("CA Munim")).toBeInTheDocument();
    expect(screen.getByText(/CA R Sharma/)).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("₹1,25,000")).toBeInTheDocument();
  });

  describe("M36 status-colour semantics", () => {
    it("colours the overdue metric red and the due-this-week metric amber", () => {
      renderHome();

      const overdueLabel = screen.getByText("Overdue filings");
      expect(overdueLabel).toHaveClass("text-red-600");
      const overdueValue = screen.getByText("3");
      expect(overdueValue).toHaveClass("text-red-600");

      const dueLabel = screen.getByText("Due this week");
      expect(dueLabel).toHaveClass("text-orange-600");
      const dueValue = screen.getByText("7");
      expect(dueValue).toHaveClass("text-orange-600");
    });

    it("keeps the count-only cards (clients, fees) neutral — no red or amber", () => {
      renderHome();

      const clientsLabel = screen.getByText("Active clients");
      expect(clientsLabel.className).not.toMatch(/text-(red|orange)-600/);
      const feesLabel = screen.getByText("Fees to collect");
      expect(feesLabel.className).not.toMatch(/text-(red|orange)-600/);
    });
  });

  describe("digest badges", () => {
    it("shows an overdue badge in red and a due-today badge in amber", () => {
      renderHome({
        digest: buildDigestItems(2, (i) =>
          i === 0
            ? { id: "over", clientName: "Overdue Co", daysOverdue: 4 }
            : { id: "today", clientName: "Today Co", daysOverdue: 0 },
        ),
      });

      const overdueBadge = screen.getByText("4d overdue");
      expect(overdueBadge).toHaveClass("bg-red-50");
      expect(overdueBadge).toHaveClass("text-red-600");

      const todayBadge = screen.getByText("Due today");
      expect(todayBadge).toHaveClass("bg-orange-50");
      expect(todayBadge).toHaveClass("text-orange-600");
    });

    it("renders the Nudge and Mark-filed actions per digest item", () => {
      renderHome({ digest: buildDigestItems(2, (i) => ({ id: `d-${i}`, clientName: `Client ${i}` })) });

      expect(screen.getAllByRole("button", { name: /Nudge on WhatsApp/ })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: /Mark filed/ })).toHaveLength(2);
    });

    it("shows the caught-up empty state when the digest is empty", () => {
      renderHome({ digest: [] });
      expect(screen.getByText(/All caught up/)).toBeInTheDocument();
    });
  });

  // The exact unbounded-list class: fetchDigest can return 50 items; the mobile
  // home caps the render at DIGEST_VISIBLE_LIMIT (5) with a "+N more" link.
  it("caps the digest at 5 with a '+N more' link and navigates to Tasks", async () => {
    renderHome({ digest: buildDigestItems(50, (i) => ({ clientName: `Digest Client ${i}`, daysOverdue: i + 1 })) });

    expect(screen.getAllByText(/Digest Client \d+/)).toHaveLength(5);
    expect(screen.queryByText(/Digest Client 20\b/)).not.toBeInTheDocument();

    const viewAll = screen.getByRole("button", { name: /\+45 more — View all in Tasks/ });
    fireEvent.click(viewAll);
    expect(await screen.findByText("TASKS_PAGE_SENTINEL")).toBeInTheDocument();
  });

  describe("compliance calendar rows", () => {
    it("colours an overdue deadline red and an upcoming one amber", () => {
      renderHome({
        complianceAlerts: [
          alert({ id: "over", filingType: "TDS Challan", daysUntilDue: -5, urgency: "overdue" }),
          alert({ id: "soon", filingType: "GSTR-1", daysUntilDue: 6, urgency: "upcoming" }),
        ],
      });

      const overdueLine = screen.getByText(/5d overdue/);
      expect(overdueLine).toHaveClass("text-red-600");
      const upcomingLine = screen.getByText(/in 6d/);
      expect(upcomingLine).toHaveClass("text-orange-600");
    });

    it("shows the compliance empty state when there are no alerts", () => {
      renderHome({ complianceAlerts: [] });
      expect(screen.getByText("No upcoming deadlines in the next 30 days.")).toBeInTheDocument();
    });
  });

  it("renders the four quick-action buttons", () => {
    renderHome();

    // Scope to the Quick actions section to avoid colliding with modal labels.
    expect(screen.getByRole("button", { name: "Add Client" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Invoice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk WhatsApp" })).toBeInTheDocument();
  });
});
