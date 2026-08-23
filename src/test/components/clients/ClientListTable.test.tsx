import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientListTable } from "@/components/clients/ClientListTable";
import type { Client } from "@/hooks/useClients";

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Aarav Traders Private Limited",
    type: "Private Ltd",
    pan: "ABCDE1234F",
    phone: "9876543210",
    email: "aarav@example.com",
    activeTasks: 2,
    pendingFees: 125000,
    feesOverdue: false,
    lastActivity: "2026-05-09",
    city: "Mumbai",
    state: "Maharashtra",
    servicesSubscribed: [],
    ...overrides,
  } as Client;
}

// Factory for the firm-scale render, matching the fixtures/dashboard.ts style.
function buildClients(n: number): Client[] {
  return Array.from({ length: n }, (_, i) =>
    client({
      id: `bulk-${i}`,
      name: `Bulk Client ${String(i).padStart(3, "0")}`,
      pan: `BULKP${i}234F`,
    }),
  );
}

describe("ClientListTable", () => {
  it("renders the full column set in order", () => {
    render(<ClientListTable clients={[client()]} onEdit={vi.fn()} onView={vi.fn()} />);

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "Client Name",
      "PAN",
      "Phone",
      "Active Tasks",
      "Pending Fees",
      "Last Activity",
      "Actions",
    ]);
  });

  // M36 round 5: the fixed max-w-[14rem] cap on the name span (which produced
  // "Aarav Tr…") was removed. The name is no longer capped by a hardcoded
  // pixel width; overflow is handled by `truncate` within the cell plus a
  // native `title` tooltip carrying the full name.
  it("does NOT hard-cap the client name with a fixed max-width, and exposes the full name via title", () => {
    const longName = "Aarav Traders And Sons Global Enterprises Private Limited";
    render(<ClientListTable clients={[client({ name: longName })]} onEdit={vi.fn()} onView={vi.fn()} />);

    const nameEl = screen.getByText(longName);
    // Full name is present in the DOM (not truncated to a shorter string).
    expect(nameEl).toBeInTheDocument();
    // The stacked layout wraps the name in a container carrying the title.
    const titled = nameEl.closest("[title]");
    expect(titled).not.toBeNull();
    expect(titled).toHaveAttribute("title", longName);
    // No fixed max-width class remains on the name element or its titled wrapper.
    expect(nameEl.className).not.toMatch(/max-w-\[/);
    expect((titled as HTMLElement).className).not.toMatch(/max-w-\[/);
  });

  it("renders the client type as a stacked sub-label under the name", () => {
    render(<ClientListTable clients={[client({ type: "Private Ltd" })]} onEdit={vi.fn()} onView={vi.fn()} />);
    expect(screen.getByText("Private Ltd")).toBeInTheDocument();
  });

  it("marks the Last Activity column as hidden below xl (hidden xl:table-cell)", () => {
    render(<ClientListTable clients={[client()]} onEdit={vi.fn()} onView={vi.fn()} />);

    const lastActivityHeader = screen.getByRole("columnheader", { name: "Last Activity" });
    expect(lastActivityHeader).toHaveClass("hidden");
    expect(lastActivityHeader).toHaveClass("xl:table-cell");
  });

  it("exposes accessible WhatsApp / Edit / View actions with the right handlers", () => {
    const onEdit = vi.fn();
    const onView = vi.fn();
    render(<ClientListTable clients={[client({ name: "Amit Co" })]} onEdit={onEdit} onView={onView} />);

    const whatsapp = screen.getByRole("link", { name: "Send WhatsApp message to Amit Co" });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/919876543210");
    expect(whatsapp).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByRole("button", { name: "Edit Amit Co" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toMatchObject({ name: "Amit Co" });

    fireEvent.click(screen.getByRole("button", { name: "View Amit Co" }));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it("fires onView when the row itself is clicked", () => {
    const onView = vi.fn();
    render(<ClientListTable clients={[client({ name: "Row Click Co" })]} onEdit={vi.fn()} onView={onView} />);

    fireEvent.click(screen.getByText("Row Click Co"));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it("renders overdue fees in the destructive colour and normal fees neutral", () => {
    render(
      <ClientListTable
        clients={[
          client({ id: "a", name: "Overdue Co", pendingFees: 50000, feesOverdue: true }),
          client({ id: "b", name: "Current Co", pendingFees: 20000, feesOverdue: false }),
        ]}
        onEdit={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(screen.getByText("₹50,000")).toHaveClass("text-destructive");
    expect(screen.getByText("₹20,000")).not.toHaveClass("text-destructive");
  });

  it("renders a firm-scale (50 row) dataset without crashing", () => {
    render(<ClientListTable clients={buildClients(50)} onEdit={vi.fn()} onView={vi.fn()} />);

    expect(screen.getByText("Bulk Client 000")).toBeInTheDocument();
    expect(screen.getByText("Bulk Client 049")).toBeInTheDocument();
    // The table itself carries the fixed-layout / full-width treatment.
    expect(screen.getAllByRole("row")).toHaveLength(51); // 1 header + 50 data rows
  });
});
