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

  it("computes MGT-7/AOC-4/ADT-1 due dates relative to the client's AGM month", () => {
    const mgt7 = rule({ periodType: "annual", dueDateRule: { type: "relative_to_agm", offset_days: 60 } });
    const aoc4 = rule({ periodType: "annual", dueDateRule: { type: "relative_to_agm", offset_days: 30 } });
    const adt1 = rule({ periodType: "annual", dueDateRule: { type: "relative_to_agm", offset_days: 15 } });
    // FY 2025-26 (fyStartYear 2025) -> AGM falls in calendar year 2026.
    // agm_due_month 9 (September) -> AGM due 30 Sep 2026.
    expect(computeDueDate(aoc4, 2025, undefined, 9)).toBe("2026-10-30"); // 30 days after 30 Sep
    expect(computeDueDate(mgt7, 2025, undefined, 9)).toBe("2026-11-29"); // 60 days after 30 Sep
    expect(computeDueDate(adt1, 2025, undefined, 9)).toBe("2026-10-15"); // 15 days after 30 Sep
  });

  it("returns null for relative_to_agm rules when the client has no agm_due_month set", () => {
    const mgt7 = rule({ periodType: "annual", dueDateRule: { type: "relative_to_agm", offset_days: 60 } });
    expect(computeDueDate(mgt7, 2025)).toBeNull();
  });

  it("handles a February AGM month correctly (last day of Feb, non-leap and leap years)", () => {
    const aoc4 = rule({ periodType: "annual", dueDateRule: { type: "relative_to_agm", offset_days: 30 } });
    // FY 2026-27 -> AGM calendar year 2027, Feb has 28 days (not a leap year).
    expect(computeDueDate(aoc4, 2026, undefined, 2)).toBe("2027-03-30"); // 28 Feb 2027 + 30 days
    // FY 2027-28 -> AGM calendar year 2028, a leap year (Feb has 29 days).
    expect(computeDueDate(aoc4, 2027, undefined, 2)).toBe("2028-03-30"); // 29 Feb 2028 + 30 days
  });

  it("computes INC-20A due date as 180 days from the client's incorporation date (date_of_birth)", () => {
    const inc20a = rule({ periodType: "annual", dueDateRule: { type: "relative_to_client_date", field: "date_of_birth", offset_days: 180 } });
    expect(computeDueDate(inc20a, 2025, undefined, undefined, "2025-01-01")).toBe("2025-06-30");
  });

  it("computes PAS-3 due date as 30 days from the client's last allotment date", () => {
    const pas3 = rule({ periodType: "annual", dueDateRule: { type: "relative_to_client_date", field: "last_allotment_date", offset_days: 30 } });
    expect(computeDueDate(pas3, 2025, undefined, undefined, "2026-01-01")).toBe("2026-01-31");
  });

  it("returns null for relative_to_client_date rules when the client date is missing", () => {
    const inc20a = rule({ periodType: "annual", dueDateRule: { type: "relative_to_client_date", field: "date_of_birth", offset_days: 180 } });
    expect(computeDueDate(inc20a, 2025)).toBeNull();
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

  it("picks GSTR-9's per-day rate by turnover slab, not just the cap (Notification 07/2023)", () => {
    const r = rule({
      lateFeeRule: {
        slabs: [
          { turnover_upto: 50_000_000, per_day: 50, max_percentage: 0.0004 },
          { turnover_upto: 200_000_000, per_day: 100, max_percentage: 0.0004 },
          { turnover_upto: null, per_day: 200, max_percentage: 0.005 },
        ],
      },
    });
    // 1000 days accrued is enough to hit the cap for the <=5cr and 5-20cr
    // slabs (50-100/day), isolating each slab's own per_day + max_percentage.
    expect(computeLateFee(r, 1000, { turnover: 40_000_000 })?.amount).toBe(16000); // <=5cr: 0.04% of 4cr
    expect(computeLateFee(r, 1000, { turnover: 100_000_000 })?.amount).toBe(40000); // 5-20cr: 0.04% of 10cr
    // >20cr's 200/day accrues slower relative to its larger 0.50% cap, so it
    // needs more days to actually hit that cap (200 x 10000 > 0.5% of 30cr).
    expect(computeLateFee(r, 10_000, { turnover: 300_000_000 })?.amount).toBe(1_500_000); // >20cr: 0.50% of 30cr
    // Below the cap, the >20cr slab is a plain per-day accrual.
    expect(computeLateFee(r, 1000, { turnover: 300_000_000 })?.amount).toBe(200_000);
  });

  it("uses the 234F income-based cap for ITR", () => {
    const r = rule({ lateFeeRule: { flat_above_5L: 5000, flat_below_5L: 1000 } });
    expect(computeLateFee(r, 5, { incomeBelow5L: true })?.amount).toBe(1000);
    expect(computeLateFee(r, 5, {})?.amount).toBe(5000);
    expect(computeLateFee(r, 0, {})?.amount).toBe(0);
  });
});
