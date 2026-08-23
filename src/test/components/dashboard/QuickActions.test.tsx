import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickActions } from "@/components/dashboard/QuickActions";

// QuickActions calls useClients/useTasks for its modal save handlers and mounts
// four heavy modals. Mock the hooks and stub the modals so the render is about
// the M37 button hierarchy, not the modal trees.
vi.mock("@/hooks/useClients", () => ({ useClients: () => ({ addClient: vi.fn() }) }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: () => ({ addTask: vi.fn() }) }));
vi.mock("@/components/clients/AddClientModal", () => ({ AddClientModal: () => null }));
vi.mock("@/components/tasks/AddTaskModal", () => ({ AddTaskModal: () => null }));
vi.mock("@/components/billing/CreateInvoiceModal", () => ({ CreateInvoiceModal: () => null }));
vi.mock("@/components/whatsapp/BulkSender", () => ({ BulkSender: () => null }));

describe("QuickActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all four quick-action buttons", () => {
    render(<QuickActions />);

    expect(screen.getByRole("button", { name: /Add New Client/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bulk WhatsApp Reminder/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Task/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate Invoice/ })).toBeInTheDocument();
  });

  it("gives Add New Client the sole filled/accent treatment", () => {
    render(<QuickActions />);

    const addClient = screen.getByRole("button", { name: /Add New Client/ });
    expect(addClient).toHaveClass("bg-accent");
    expect(addClient).toHaveClass("text-accent-foreground");

    // No other action button is filled with the accent colour.
    const filled = screen
      .getAllByRole("button")
      .filter((b) => b.classList.contains("bg-accent"));
    expect(filled).toHaveLength(1);
    expect(filled[0]).toBe(addClient);
  });

  it("styles Bulk WhatsApp Reminder as a WhatsApp-green outline, not a second filled block", () => {
    render(<QuickActions />);

    const whatsapp = screen.getByRole("button", { name: /Bulk WhatsApp Reminder/ });
    expect(whatsapp).toHaveClass("border-2");
    expect(whatsapp).toHaveClass("border-whatsapp");
    expect(whatsapp).toHaveClass("text-whatsapp");
    // It is an outline, not filled with the primary accent.
    expect(whatsapp).not.toHaveClass("bg-accent");
  });

  it("styles Create Task and Generate Invoice as neutral outline buttons", () => {
    render(<QuickActions />);

    for (const name of [/Create Task/, /Generate Invoice/]) {
      const btn = screen.getByRole("button", { name });
      expect(btn).toHaveClass("border");
      expect(btn).toHaveClass("border-border");
      expect(btn).not.toHaveClass("bg-accent");
    }
  });
});
