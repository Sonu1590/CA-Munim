import { describe, it, expect } from "vitest";
import { calculatePenalty } from "@/lib/penaltyRules";
import type { ComplianceRule } from "@/data/ComplianceRules";

// Rule shapes below are copied verbatim from the live compliance_rules table
// (djzsjkjdvzqxybltikmr, checked 2026-07-14) so these tests exercise the
// exact data the Penalty Calculator reads in production, not a guessed shape.
const RULES: ComplianceRule[] = [
  {
    filingType: "GSTR-3B_MONTHLY_ABOVE5CR",
    dueDateRule: { type: "fixed_day", day: 20, month_offset: 1 },
    lateFeeRule: { per_day: 50, max: 2000, nil_per_day: 20, nil_max: 500 },
  },
  {
    filingType: "GSTR-1_MONTHLY",
    dueDateRule: { type: "fixed_day", day: 11, month_offset: 1 },
    lateFeeRule: { per_day: 50, max: 2000, nil_per_day: 20, nil_max: 500 },
  },
  {
    filingType: "GSTR-9",
    dueDateRule: { type: "fixed_date", day: 31, month: 12 },
    lateFeeRule: {
      slabs: [
        { per_day: 50, turnover_upto: 50_000_000, max_percentage: 0.0004 },
        { per_day: 100, turnover_upto: 200_000_000, max_percentage: 0.0004 },
        { per_day: 200, turnover_upto: null, max_percentage: 0.005 },
      ],
    },
  },
  {
    filingType: "ITR_NON_AUDIT",
    dueDateRule: { type: "fixed_date", day: 31, month: 7 },
    lateFeeRule: { flat_above_5L: 5000, flat_below_5L: 1000 },
  },
  {
    filingType: "ROC_ANNUAL_FILING",
    dueDateRule: null,
    lateFeeRule: { per_day: 100 },
  },
  {
    filingType: "TDS_RETURN_24Q_26Q",
    dueDateRule: { type: "fixed_day", day: 31, month_offset: 1, after_quarter_end: true, q4_exception: { day: 31, month: 5 } },
    lateFeeRule: { per_day: 200, max_equals_tds: true },
  },
] as unknown as ComplianceRule[];

const due = new Date("2026-07-01");
const late10 = new Date("2026-07-11"); // 10 days late

describe("calculatePenalty — publishability gate (ISSUES.md)", () => {
  it("GSTR-3B nil return: ₹20/day capped at ₹500, not the old flat ₹5,000", () => {
    const r = calculatePenalty("gstr3b", due, late10, { isNilReturn: true }, RULES);
    expect(r?.amount).toBe(200); // 20 * 10, under the 500 cap
  });

  it("GSTR-3B nil return caps at ₹500 for a long delay", () => {
    const farLate = new Date("2026-09-01"); // 62 days late
    const r = calculatePenalty("gstr3b", due, farLate, { isNilReturn: true }, RULES);
    expect(r?.amount).toBe(500);
  });

  it("GSTR-1 turnover ≤ ₹1.5cr uses the base ₹2,000 cap (small-filer slab)", () => {
    const r = calculatePenalty("gstr1", due, late10, { turnover: 10_000_000 }, RULES);
    expect(r?.amount).toBe(500); // 50/day * 10 days, well under 2000 cap
  });

  it("GSTR-1 turnover >₹5cr scales the cap 5x (₹10,000), not a flat ₹5,000", () => {
    const farLate = new Date("2026-09-15"); // 76 days late -> 50*76=3800 uncapped
    const r = calculatePenalty("gstr1", due, farLate, { turnover: 80_000_000 }, RULES);
    expect(r?.amount).toBe(3800);
    const veryFarLate = new Date("2027-02-01"); // 215 days late -> 50*215=10750, over the 10000 cap
    const r2 = calculatePenalty("gstr1", due, veryFarLate, { turnover: 80_000_000 }, RULES);
    expect(r2?.amount).toBe(10_000); // capped at max(2000) * 5
  });

  it("GSTR-9 uses the turnover-slab per-day rate, not a flat ₹200/day", () => {
    const r = calculatePenalty("gstr9", due, late10, { turnover: 30_000_000 }, RULES);
    expect(r?.amount).toBe(500); // ≤5cr slab: 50/day * 10 days
    const r2 = calculatePenalty("gstr9", due, late10, { turnover: 300_000_000 }, RULES);
    expect(r2?.amount).toBe(2000); // >20cr slab: 200/day * 10 days
  });

  it("ITR caps at ₹1,000 when income ≤ ₹5L, ₹5,000 otherwise", () => {
    const below = calculatePenalty("itr", due, late10, { incomeBelow5L: true }, RULES);
    expect(below?.amount).toBe(1000);
    const above = calculatePenalty("itr", due, late10, { incomeBelow5L: false }, RULES);
    expect(above?.amount).toBe(5000);
  });

  it("TDS return caps at the actual TDS amount, not uncapped", () => {
    const r = calculatePenalty("tds", due, late10, { tdsAmount: 1500 }, RULES);
    expect(r?.amount).toBe(1500); // 200*10=2000, capped down to the 1500 TDS amount
  });

  it("ROC filing is uncapped per-day (Section 403 has no ceiling)", () => {
    const r = calculatePenalty("roc", due, late10, {}, RULES);
    expect(r?.amount).toBe(1000); // 100/day * 10 days, no cap
  });

  it("Advance Tax uses the real actualShortfall input, not a fabricated placeholder", () => {
    const r = calculatePenalty("advTax", due, late10, { actualShortfall: 45_000 }, RULES);
    // ceil(10/30) = 1 month, 1% of 45000
    expect(r?.amount).toBe(450);
    expect(r?.breakdown).toContain("45,000");
  });

  it("Advance Tax with no shortfall entered returns ₹0, never a hardcoded ₹100,000-based figure", () => {
    const r = calculatePenalty("advTax", due, late10, {}, RULES);
    expect(r?.amount).toBe(0);
  });
});
