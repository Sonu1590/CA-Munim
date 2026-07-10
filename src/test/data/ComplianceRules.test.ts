import { describe, expect, it } from "vitest";
import { computeDueDate, computeLateFee, selectRuleForFY, type ComplianceRule } from "@/data/ComplianceRules";

const rule = (overrides: Partial<ComplianceRule>): ComplianceRule => ({
  filingType: "TEST",
  periodType: null,
  dueDateRule: null,
  lateFeeRule: null,
  interestSection: null,
  notificationRef: null,
  effectiveFrom: null,
  effectiveTo: null,
  active: true,
  ...overrides,
});

describe("selectRuleForFY", () => {
  it("picks the GSTR-4 rule whose fy_start_year range covers the requested FY", () => {
    const rules = [
      rule({ filingType: "GSTR-4", dueDateRule: { type: "fixed_date", day: 30, month: 4, year_offset: 1, max_fy_start_year: 2023 } }),
      rule({ filingType: "GSTR-4", dueDateRule: { type: "fixed_date", day: 30, month: 6, year_offset: 1, min_fy_start_year: 2024 } }),
    ];
    expect(selectRuleForFY(rules, "GSTR-4", 2023)?.dueDateRule).toMatchObject({ month: 4 });
    expect(selectRuleForFY(rules, "GSTR-4", 2024)?.dueDateRule).toMatchObject({ month: 6 });
    expect(selectRuleForFY(rules, "GSTR-4", 2026)?.dueDateRule).toMatchObject({ month: 6 });
  });
});

describe("computeDueDate", () => {
  it("computes GSTR-4 due date correctly on both sides of the 2024 rule change", () => {
    const oldRule = rule({ periodType: "annual", dueDateRule: { type: "fixed_date", day: 30, month: 4, year_offset: 1, max_fy_start_year: 2023 } });
    const newRule = rule({ periodType: "annual", dueDateRule: { type: "fixed_date", day: 30, month: 6, year_offset: 1, min_fy_start_year: 2024 } });
    expect(computeDueDate(oldRule, 2023)).toBe("2024-04-30");
    expect(computeDueDate(newRule, 2024)).toBe("2025-06-30");
  });

  it("computes GSTR-9 due date as 31 Dec of the year after FY start (no explicit year_offset)", () => {
    const r = rule({ periodType: "annual", dueDateRule: { type: "fixed_date", day: 31, month: 12 } });
    expect(computeDueDate(r, 2024)).toBe("2025-12-31");
  });

  it("computes ITR non-audit due date as 31 Jul of the year after FY start", () => {
    const r = rule({ periodType: "annual", dueDateRule: { type: "fixed_date", day: 31, month: 7 } });
    expect(computeDueDate(r, 2024)).toBe("2025-07-31");
  });

  it("computes advance tax instalments within/after the FY using the default Apr-Dec/Jan-Mar convention", () => {
    const q1 = rule({ periodType: "quarterly", dueDateRule: { type: "fixed_date", day: 15, month: 6 } });
    const q4 = rule({ periodType: "quarterly", dueDateRule: { type: "fixed_date", day: 15, month: 3 } });
    expect(computeDueDate(q1, 2025)).toBe("2025-06-15");
    expect(computeDueDate(q4, 2025)).toBe("2026-03-15");
  });

  it("computes GSTR-1 due date as the 11th of the month following the filing period", () => {
    const r = rule({ periodType: "monthly", dueDateRule: { type: "fixed_day", day: 11, month_offset: 1 } });
    expect(computeDueDate(r, 2025, { month: 4, year: 2025 })).toBe("2025-05-11");
    expect(computeDueDate(r, 2025, { month: 12, year: 2025 })).toBe("2026-01-11");
  });

  it("applies TDS Challan's March exception (30 Apr instead of 7th of next month)", () => {
    const r = rule({ periodType: "monthly", dueDateRule: { type: "fixed_day", day: 7, month_offset: 1, march_exception: { day: 30, month: 4 } } });
    expect(computeDueDate(r, 2025, { month: 3, year: 2026 })).toBe("2026-04-30");
    expect(computeDueDate(r, 2025, { month: 4, year: 2025 })).toBe("2025-05-07");
  });

  it("applies TDS 24Q/26Q's Q4 exception (31 May instead of the standard offset)", () => {
    const r = rule({ periodType: "quarterly", dueDateRule: { type: "fixed_day", day: 31, month_offset: 1, q4_exception: { day: 31, month: 5 } } });
    expect(computeDueDate(r, 2025, { month: 3, year: 2026 })).toBe("2026-05-31");
    expect(computeDueDate(r, 2025, { month: 6, year: 2025 })).toBe("2025-07-31");
  });

  it("computes QRMP GSTR-3B due date at the 22nd (Cat1) or 24th (Cat2) of the month after quarter-end", () => {
    const cat1 = rule({ periodType: "quarterly", dueDateRule: { type: "fixed_day", day: 22, month_offset: 1 } });
    const cat2 = rule({ periodType: "quarterly", dueDateRule: { type: "fixed_day", day: 24, month_offset: 1 } });
    expect(computeDueDate(cat1, 2025, { month: 6, year: 2025 })).toBe("2025-07-22");
    expect(computeDueDate(cat2, 2025, { month: 6, year: 2025 })).toBe("2025-07-24");
    // Jan-Mar quarter rolls into the next calendar year.
    expect(computeDueDate(cat1, 2025, { month: 3, year: 2026 })).toBe("2026-04-22");
  });

  it("computes QRMP GSTR-1 due date at the 13th of the month after quarter-end", () => {
    const r = rule({ periodType: "quarterly", dueDateRule: { type: "fixed_day", day: 13, month_offset: 1 } });
    expect(computeDueDate(r, 2025, { month: 9, year: 2025 })).toBe("2025-10-13");
  });
});

describe("computeLateFee", () => {
  it("scales the GST monthly late-fee cap by turnover slab", () => {
    const r = rule({ lateFeeRule: { per_day: 50, max: 2000, nil_per_day: 20, nil_max: 500 } });
    // 300 days x Rs50/day = Rs15,000 accrued, well past every slab's cap.
    expect(computeLateFee(r, 300, { turnover: 1_000_000 })?.amount).toBe(2000); // capped at <=1.5cr slab
    expect(computeLateFee(r, 300, { turnover: 30_000_000 })?.amount).toBe(5000); // 1.5-5cr slab
    expect(computeLateFee(r, 300, { turnover: 100_000_000 })?.amount).toBe(10000); // >5cr slab
  });

  it("uses the flat nil-return fee when isNilReturn is set", () => {
    const r = rule({ lateFeeRule: { per_day: 50, max: 2000, nil_per_day: 20, nil_max: 500 } });
    expect(computeLateFee(r, 100, { isNilReturn: true, turnover: 100_000_000 })?.amount).toBe(500);
  });

  it("scales GSTR-9 late fee by turnover slab with a percentage cap", () => {
    const r = rule({ lateFeeRule: { per_day: 50, max_percentage: 0.0004 } });
    const result = computeLateFee(r, 1000, { turnover: 40_000_000 });
    expect(result?.amount).toBe(16000); // 0.04% of 4cr
  });

  it("uses the 234F income-based cap for ITR", () => {
    const r = rule({ lateFeeRule: { flat_above_5L: 5000, flat_below_5L: 1000 } });
    expect(computeLateFee(r, 5, { incomeBelow5L: true })?.amount).toBe(1000);
    expect(computeLateFee(r, 5, {})?.amount).toBe(5000);
    expect(computeLateFee(r, 0, {})?.amount).toBe(0);
  });
});
