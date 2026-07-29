import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReceivablesAgingReport } from "@/components/reports/ReceivablesAgingReport";
import { getReceivablesAging } from "@/data/Reports";
import type { ReceivablesAging } from "@/data/Reports";

vi.mock("@/data/Reports", async () => {
  const actual = await vi.importActual<typeof import("@/data/Reports")>("@/data/Reports");
  return { ...actual, getReceivablesAging: vi.fn() };
});

// M27, ISSUES.md — same "fixed object + overrides, generalized to also
// take a count" convention as fixtures/dashboard.ts's buildDigestItems.
function buildAging(n: number): ReceivablesAging {
  const byClient = Array.from({ length: n }, (_, i) => ({
    clientId: `client-${i}`,
    clientName: `Bulk Client ${String(i).padStart(3, "0")}`,
    buckets: { "Current": 1000, "1-30 days": 0, "31-60 days": 0, "61-90 days": 0, "90+ days": 0 } as ReceivablesAging["byClient"][number]["buckets"],
    total: 1000,
  }));
  return {
    bucketTotals: [
      { label: "Current", amount: n * 1000 },
      { label: "1-30 days", amount: 0 },
      { label: "31-60 days", amount: 0 },
      { label: "61-90 days", amount: 0 },
      { label: "90+ days", amount: 0 },
    ],
    byClient,
    totalOutstanding: n * 1000,
  };
}

describe("ReceivablesAgingReport", () => {
  it("bounds a firm-scale (60 client) table to one page of 25 with working pagination", async () => {
    vi.mocked(getReceivablesAging).mockResolvedValue(buildAging(60));

    render(<ReceivablesAgingReport />);

    await waitFor(() => expect(screen.getByTestId("desktop-receivables")).toBeInTheDocument());
    const desktop = within(screen.getByTestId("desktop-receivables"));

    expect(desktop.getByText("Bulk Client 000")).toBeInTheDocument();
    expect(desktop.getByText("Bulk Client 024")).toBeInTheDocument();
    expect(desktop.queryByText("Bulk Client 025")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(desktop.queryByText("Bulk Client 000")).not.toBeInTheDocument();
    expect(desktop.getByText("Bulk Client 025")).toBeInTheDocument();
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
  });
});
