import { supabase } from "@/lib/supabase";

// The single source of truth for statutory due dates and late fees, replacing
// three previously-separate hardcoded copies (dueDateRules in Tasks.ts,
// calculateDueDate in BulkTaskGenerator.tsx, and penaltyRules.ts) that had
// already drifted out of sync with each other and with the actual law
// (architect review, 2026-07-06 — see ISSUES.md H6).

export interface ComplianceRule {
  filingType: string;
  periodType: "monthly" | "quarterly" | "annual" | null;
  dueDateRule: DueDateRule | null;
  lateFeeRule: LateFeeRule | null;
  interestSection: string | null;
  notificationRef: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
}

// "fixed_date": an annual filing due on a fixed day/month, anchored to the
// financial year via year_offset (0 = same calendar year the FY starts in,
// 1 = the following calendar year). If year_offset is omitted, "annual"
// rules default to 1 (matches GSTR-9/ITR, both due the year after FY end)
// and other period types default via the standard Apr-Dec=start-year,
// Jan-Mar=start-year+1 convention.
// min_fy_start_year/max_fy_start_year let one filing_type carry both an old
// and a new rule (e.g. GSTR-4's 2024 due-date change) without a code change
// — pick whichever row's range covers the FY being computed.
interface FixedDateRule {
  type: "fixed_date";
  day: number;
  month: number; // 1-12
  year_offset?: 0 | 1;
  min_fy_start_year?: number;
  max_fy_start_year?: number;
}

// "fixed_day": a recurring monthly/quarterly filing due N months after the
// period being filed (month_offset), with optional named exceptions for a
// specific period (march_exception / q4_exception) that override day/month
// for that one period without touching the general rule.
interface FixedDayRule {
  type: "fixed_day";
  day: number;
  month_offset: number;
  after_quarter_end?: boolean;
  march_exception?: { day: number; month: number };
  q4_exception?: { day: number; month: number };
}

type DueDateRule = FixedDateRule | FixedDayRule;

interface LateFeeRule {
  type?: "flat";
  amount?: number;
  per_day?: number;
  max?: number;
  nil_per_day?: number;
  nil_max?: number;
  max_percentage?: number;
  flat_above_5L?: number;
  flat_below_5L?: number;
  max_equals_tds?: boolean;
  flat?: boolean;
  // GSTR-9 (Notification 07/2023): unlike the GST monthly/quarterly shape
  // above (one per_day rate, cap scales by slab), GSTR-9's per-day rate
  // itself changes by turnover slab, not just the cap. turnover_upto: null
  // marks the last (unbounded) slab; slabs must be ascending by turnover_upto.
  slabs?: { turnover_upto: number | null; per_day: number; max_percentage: number }[];
}

export async function fetchComplianceRulesFromSupabase(): Promise<ComplianceRule[]> {
  const { data, error } = await supabase
    .from("compliance_rules")
    .select(`filing_type, period_type, due_date_rule, late_fee_rule, interest_section, notification_ref, effective_from, effective_to, active`)
    .eq("active", true);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    filingType: row.filing_type,
    periodType: row.period_type,
    dueDateRule: row.due_date_rule,
    lateFeeRule: row.late_fee_rule,
    interestSection: row.interest_section,
    notificationRef: row.notification_ref,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    active: row.active,
  }));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Picks the rule for a filing type whose fy_start_year range covers the FY being computed. */
export function selectRuleForFY(rules: ComplianceRule[], filingType: string, fyStartYear: number): ComplianceRule | undefined {
  const candidates = rules.filter((r) => r.filingType === filingType);
  if (candidates.length <= 1) return candidates[0];

  return candidates.find((r) => {
    const rule = r.dueDateRule;
    const min = rule && rule.type === "fixed_date" ? rule.min_fy_start_year : undefined;
    const max = rule && rule.type === "fixed_date" ? rule.max_fy_start_year : undefined;
    if (min != null && fyStartYear < min) return false;
    if (max != null && fyStartYear > max) return false;
    return true;
  }) ?? candidates[0];
}

/**
 * Computes a due date (YYYY-MM-DD) for a rule.
 * `period` is only needed for monthly/quarterly rules — the calendar
 * month/year of the return period being filed (e.g. March 2026 for the
 * FY2025-26 Q4/year-end return), not the due date itself.
 */
export function computeDueDate(rule: ComplianceRule, fyStartYear: number, period?: { month: number; year: number }): string | null {
  const dueDateRule = rule.dueDateRule;
  if (!dueDateRule) return null;

  if (dueDateRule.type === "fixed_date") {
    const yearOffset = dueDateRule.year_offset ?? (rule.periodType === "annual" ? 1 : dueDateRule.month <= 3 ? 1 : 0);
    const year = fyStartYear + yearOffset;
    return `${year}-${pad(dueDateRule.month)}-${pad(dueDateRule.day)}`;
  }

  // fixed_day needs a period to offset from.
  if (!period) return null;

  if (period.month === 3 && dueDateRule.march_exception) {
    const { day, month } = dueDateRule.march_exception;
    return `${period.year}-${pad(month)}-${pad(day)}`;
  }
  if (period.month === 3 && dueDateRule.q4_exception) {
    const { day, month } = dueDateRule.q4_exception;
    return `${period.year}-${pad(month)}-${pad(day)}`;
  }

  let month = period.month + dueDateRule.month_offset;
  let year = period.year;
  if (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${pad(month)}-${pad(dueDateRule.day)}`;
}

export interface PenaltyInputs {
  turnover?: number;
  isNilReturn?: boolean;
  incomeBelow5L?: boolean;
  actualShortfall?: number;
  tdsAmount?: number;
}

export function computeLateFee(rule: ComplianceRule, daysLate: number, inputs: PenaltyInputs = {}): { amount: number; breakdown: string } | null {
  const feeRule = rule.lateFeeRule;
  if (!feeRule) return null;

  if (feeRule.flat_above_5L != null && feeRule.flat_below_5L != null) {
    const cap = inputs.incomeBelow5L ? feeRule.flat_below_5L : feeRule.flat_above_5L;
    const amount = daysLate > 0 ? cap : 0;
    return { amount, breakdown: `Flat ₹${cap.toLocaleString("en-IN")}${inputs.incomeBelow5L ? " (total income ≤ ₹5L)" : ""}` };
  }

  if (feeRule.flat) {
    const amount = daysLate > 0 ? (feeRule.amount ?? 0) : 0;
    return { amount, breakdown: `Flat ₹${amount.toLocaleString("en-IN")}` };
  }

  if (feeRule.nil_per_day != null && inputs.isNilReturn) {
    const amount = Math.min(daysLate * feeRule.nil_per_day, feeRule.nil_max ?? Infinity);
    return { amount, breakdown: `Nil return: ₹${feeRule.nil_per_day}/day × ${daysLate} days${feeRule.nil_max ? ` (capped at ₹${feeRule.nil_max})` : ""}` };
  }

  if (feeRule.slabs) {
    const turnover = inputs.turnover ?? 0;
    const slab = feeRule.slabs.find((s) => s.turnover_upto == null || turnover <= s.turnover_upto) ?? feeRule.slabs[feeRule.slabs.length - 1];
    const cap = Math.round(turnover * slab.max_percentage);
    const amount = Math.min(daysLate * slab.per_day, cap);
    return { amount, breakdown: `₹${slab.per_day}/day × ${daysLate} days (capped at ${(slab.max_percentage * 100).toFixed(2)}% of turnover = ₹${cap.toLocaleString("en-IN")})` };
  }

  if (feeRule.max_percentage != null) {
    const turnover = inputs.turnover ?? 0;
    const cap = Math.round(turnover * feeRule.max_percentage);
    const perDay = feeRule.per_day ?? 0;
    const amount = Math.min(daysLate * perDay, cap);
    return { amount, breakdown: `₹${perDay}/day × ${daysLate} days (capped at ${(feeRule.max_percentage * 100).toFixed(2)}% of turnover = ₹${cap.toLocaleString("en-IN")})` };
  }

  if (feeRule.max_equals_tds) {
    const perDay = feeRule.per_day ?? 0;
    const amount = Math.min(daysLate * perDay, inputs.tdsAmount ?? Infinity);
    return { amount, breakdown: `₹${perDay}/day × ${daysLate} days u/s ${rule.interestSection ?? ""} (capped at TDS amount)` };
  }

  if (feeRule.per_day != null && feeRule.max != null) {
    // GST monthly late fee is turnover-slabbed (Notification 19/2021 for
    // GSTR-3B/1): the stored `max` is the ≤₹1.5cr slab; scale up for larger
    // turnovers rather than needing a separate row per slab.
    const turnover = inputs.turnover ?? 0;
    const cap = turnover <= 15_000_000 ? feeRule.max : turnover <= 50_000_000 ? feeRule.max * 2.5 : feeRule.max * 5;
    const amount = Math.min(daysLate * feeRule.per_day, cap);
    const slabLabel = turnover <= 15_000_000 ? "≤₹1.5cr" : turnover <= 50_000_000 ? "₹1.5–5cr" : ">₹5cr";
    return { amount, breakdown: `₹${feeRule.per_day}/day × ${daysLate} days (capped at ₹${cap.toLocaleString("en-IN")} for turnover ${slabLabel})` };
  }

  // Uncapped flat per-day fee (e.g. ROC Section 403 — ₹100/day per form,
  // no upper limit). Must come last: every other per_day shape above is
  // more specific and should win first.
  if (feeRule.per_day != null) {
    const amount = daysLate * feeRule.per_day;
    return { amount, breakdown: `₹${feeRule.per_day}/day × ${daysLate} days${rule.interestSection ? ` u/s ${rule.interestSection}` : ""} (no upper cap)` };
  }

  return null;
}
