import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionBilling } from "@/components/settings/SubscriptionBilling";
import {
  fetchSubscriptionPlansFromSupabase,
  fetchFoundingMemberSlotsRemaining,
  fetchCurrentSubscriptionFromSupabase,
  type SubscriptionPlan,
} from "@/data/Settings";

vi.mock("@/data/Settings", () => ({
  fetchSubscriptionPlansFromSupabase: vi.fn(),
  fetchFoundingMemberSlotsRemaining: vi.fn(),
  fetchCurrentSubscriptionFromSupabase: vi.fn(),
}));

vi.mock("@/components/billing/RazorpayCheckoutModal", () => ({
  RazorpayCheckoutModal: () => null,
}));

const mockPlans = vi.mocked(fetchSubscriptionPlansFromSupabase);
const mockSlots = vi.mocked(fetchFoundingMemberSlotsRemaining);
const mockSub = vi.mocked(fetchCurrentSubscriptionFromSupabase);

const plans: SubscriptionPlan[] = [
  { id: "p1", name: "Starter", price: 0, priceAnnual: 0, clientLimit: 20, staffLimit: 1, features: ["Up to 20 clients"] },
  { id: "p2", name: "Professional", price: 999, priceAnnual: 9990, clientLimit: 100, staffLimit: 3, features: ["Up to 100 clients"] },
  { id: "p3", name: "Founding Member", price: 4999, priceAnnual: 49990, clientLimit: 999, staffLimit: 10, features: ["Locked pricing"] },
];

async function renderBilling(slotsLeft: number | null = 50) {
  mockPlans.mockResolvedValue(plans);
  mockSlots.mockResolvedValue(slotsLeft as never);
  mockSub.mockResolvedValue({ plan: "Starter" } as never);
  render(<SubscriptionBilling />);
  await waitFor(() => expect(screen.getByText("Professional")).toBeInTheDocument());
}

function cardFor(name: string): HTMLElement {
  // The plan Card is the ancestor carrying the shadcn card border classes.
  const el = screen.getByText(name).closest("div.rounded-lg");
  if (!el) throw new Error(`card for ${name} not found`);
  return el as HTMLElement;
}

describe("SubscriptionBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state before plans resolve", () => {
    mockPlans.mockReturnValue(new Promise(() => {}) as never);
    mockSlots.mockReturnValue(new Promise(() => {}) as never);
    mockSub.mockReturnValue(new Promise(() => {}) as never);

    render(<SubscriptionBilling />);
    expect(screen.getByText("Loading plans...")).toBeInTheDocument();
  });

  // M38: Founding Member is deliberately annual-only and ignores the page
  // Monthly/Annual toggle. On the Monthly view, priced siblings show /month but
  // Founding still shows /year plus an explicit "Billed annually" note.
  it("keeps Founding Member annual-only on the Monthly view while siblings show /month", async () => {
    await renderBilling();

    // Default cycle is Monthly.
    expect(within(cardFor("Professional")).getByText("/month")).toBeInTheDocument();
    const founding = within(cardFor("Founding Member"));
    expect(founding.getByText("/year")).toBeInTheDocument();
    expect(founding.getByText(/Billed annually/)).toBeInTheDocument();
  });

  // M38 also added an equivalent-unit subtext so a user comparing cards under
  // "Monthly" can see each plan's annual figure without mental math. The annual
  // number is the plan's own independently-set priceAnnual, not price*12.
  it("shows Professional's annual-equivalent subtext on the Monthly view", async () => {
    await renderBilling();

    const professional = within(cardFor("Professional"));
    expect(professional.getByText("/month")).toBeInTheDocument();
    expect(professional.getByText(/₹9,990\/yr if billed annually/)).toBeInTheDocument();
  });

  // M39: the scarcity badge must read "Limited to first 50 firms" at the
  // starting state (50 left), not "50 of 50 left" (which reads as "nobody
  // bought this").
  it("shows 'Limited to first 50 firms' when all 50 founding slots remain", async () => {
    await renderBilling(50);
    expect(screen.getByText("Limited to first 50 firms")).toBeInTheDocument();
    expect(screen.queryByText("50 of 50 left")).not.toBeInTheDocument();
  });

  it("shows a live countdown once founding slots have moved", async () => {
    await renderBilling(30);
    expect(screen.getByText("30 of 50 left")).toBeInTheDocument();
  });

  it("shows 'Sold out' and disables the founding CTA when no slots remain", async () => {
    await renderBilling(0);

    const founding = within(cardFor("Founding Member"));
    // "Sold out" appears twice — the scarcity badge and the disabled CTA.
    expect(founding.getAllByText("Sold out")).toHaveLength(2);
    expect(founding.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });

  it("marks the current plan and disables its CTA", async () => {
    await renderBilling();
    // Subscription mock returns "Starter" as current.
    expect(within(cardFor("Starter")).getByText("Current")).toBeInTheDocument();
    expect(within(cardFor("Starter")).getByRole("button", { name: "Current Plan" })).toBeDisabled();
  });
});
