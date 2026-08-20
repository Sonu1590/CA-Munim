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

// "relative_to_agm": MGT-7/AOC-4/ADT-1 due dates aren't anchored to the FY
// itself — they're N days after the company's AGM, which is held sometime
// after FY end (clients.agm_due_month, the calendar month a client's AGM
// falls in — captured on the client record, not derivable from the FY
// alone). Always resolves against the calendar year after the FY starts
// (agm_due_month is by definition after FY end), matching FixedDateRule's
// annual default.
interface RelativeToAgmRule {
  type: "relative_to_agm";
  offset_days: number;
}

// "relative_to_client_date": one-time, event-based filings (INC-20A, PAS-3)
// due N days after a specific date already captured on the client record —
// not derived from the FY at all, unlike every other rule shape here.
// `field` names which clients column holds that date; the caller resolves
// the actual value (computeDueDate takes it as a plain string, not a
// client object, to keep this module free of a Client type dependency).
interface RelativeToClientDateRule {
  type: "relative_to_client_date";
  field: "date_of_birth" | "last_allotment_date";
  offset_days: number;
}

type DueDateRule = FixedDateRule | FixedDayRule | RelativeToAgmRule | RelativeToClientDateRule;

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
  // PAS-3 (Sec 39(5)): ₹per_day up to a FLAT hard cap — distinct from `max`
  // above, which is the GST base cap that scales with turnover. hard_max
  // never scales.
  hard_max?: number;
  // INC-20A (Sec 10A): a flat penalty on the company PLUS a separate per-day
  // penalty on every officer in default (capped) — compound, not expressible
  // as any single flat/per-day shape.
  company_flat?: number;
  officer_per_day?: number;
  officer_max?: number;
  // Tax audit report (Sec 271B): a one-time percentage of turnover with an
  // absolute cap — a flat penalty on default, NOT a per-day accrual (so
  // daysLate only gates whether it applies), unlike max_percentage above
  // which caps a per-day accrual.
  flat_pct_of_turnover?: number;
  max_amount?: number;
  // CMP-08 (Sec 50) / TDS challan (Sec 201(1A)): the real charge is interest
  // on unpaid tax/TDS, not a filing late fee. `on` selects which PenaltyInput
  // carries the principal; "annual" accrues per day (×days/365, GST style),
  // "monthly" per month-or-part (×ceil(days/30), TDS style).
  interest?: { rate: number; period: "annual" | "monthly"; on: "tax" | "tds" };
  // ADT-1 (Sec 139): MCA additional fee = a nominal-capital-based normal fee
  // × a delay multiplier — kept the multiplier structure that AOC-4/MGT-7
  // dropped for a flat ₹100/day in 2018. Needs inputs.nominalCapital.
  mca_capital_slab_fee?: boolean;
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
 * `agmDueMonth` (1-12) is only needed for "relative_to_agm" rules
 * (MGT-7/AOC-4/ADT-1) — a client's clients.agm_due_month.
 * `clientDate` (YYYY-MM-DD) is only needed for "relative_to_client_date"
 * rules (INC-20A/PAS-3) — whichever client column the rule's `field` names
 * (the caller resolves which one, since this module doesn't know Client's
 * shape).
 */
export function computeDueDate(rule: ComplianceRule, fyStartYear: number, period?: { month: number; year: number }, agmDueMonth?: number, clientDate?: string): string | null {
  const dueDateRule = rule.dueDateRule;
  if (!dueDateRule) return null;

  if (dueDateRule.type === "fixed_date") {
    const yearOffset = dueDateRule.year_offset ?? (rule.periodType === "annual" ? 1 : dueDateRule.month <= 3 ? 1 : 0);
    const year = fyStartYear + yearOffset;
    return `${year}-${pad(dueDateRule.month)}-${pad(dueDateRule.day)}`;
  }

  if (dueDateRule.type === "relative_to_agm") {
    if (agmDueMonth == null) return null;
    // AGM is always in the calendar year after the FY starts. Pure UTC
    // arithmetic throughout (Date.UTC in, getUTCDate/toISOString out) —
    // constructing from a locally-interpreted date string here would risk
    // the same off-by-one-day bug computeInvoiceDueDate had before it was
    // fixed (see useBilling.ts).
    const agmYear = fyStartYear + 1;
    // Date.UTC(year, monthIndex, 0) is day 0 of monthIndex, i.e. the last
    // day of the previous (0-indexed) month — since agmDueMonth is already
    // 1-indexed, passing it directly as monthIndex lands on the last day
    // of agmDueMonth itself.
    const dueDate = new Date(Date.UTC(agmYear, agmDueMonth, 0));
    dueDate.setUTCDate(dueDate.getUTCDate() + dueDateRule.offset_days);
    return dueDate.toISOString().split("T")[0];
  }

  if (dueDateRule.type === "relative_to_client_date") {
    if (!clientDate) return null;
    // Same pure-UTC-arithmetic discipline as relative_to_agm above —
    // parsing the YYYY-MM-DD components directly into Date.UTC rather than
    // `new Date(clientDate)`, which parses date-only strings as UTC but
    // would still invite the local-timezone bug if clientDate ever carried
    // a time component.
    const [y, m, d] = clientDate.split("-").map(Number);
    const dueDate = new Date(Date.UTC(y, m - 1, d));
    dueDate.setUTCDate(dueDate.getUTCDate() + dueDateRule.offset_days);
    return dueDate.toISOString().split("T")[0];
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
  // Principal for interest-based penalties (CMP-08's unpaid composition tax).
  taxAmount?: number;
  // Nominal share capital, for ADT-1's capital-slab MCA additional fee.
  nominalCapital?: number;
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

  // INC-20A (Sec 10A): flat ₹50,000 on the company PLUS ₹1,000/day on each
  // officer in default, the officer portion capped at ₹1,00,000.
  if (feeRule.company_flat != null) {
    if (daysLate <= 0) return { amount: 0, breakdown: "Filed on time — no penalty" };
    const officer = Math.min(daysLate * (feeRule.officer_per_day ?? 0), feeRule.officer_max ?? Infinity);
    const amount = feeRule.company_flat + officer;
    return {
      amount,
      breakdown: `Company ₹${feeRule.company_flat.toLocaleString("en-IN")} + officer ₹${(feeRule.officer_per_day ?? 0).toLocaleString("en-IN")}/day × ${daysLate} days${feeRule.officer_max ? ` (capped ₹${feeRule.officer_max.toLocaleString("en-IN")})` : ""}`,
    };
  }

  // Tax audit (Sec 271B): flat 0.5% of turnover once in default, capped at
  // ₹1.5L — daysLate only gates whether it applies, it doesn't accrue.
  if (feeRule.flat_pct_of_turnover != null) {
    if (daysLate <= 0) return { amount: 0, breakdown: "Filed on time — no penalty" };
    const turnover = inputs.turnover ?? 0;
    const raw = Math.round(turnover * feeRule.flat_pct_of_turnover);
    const amount = Math.min(raw, feeRule.max_amount ?? Infinity);
    const capped = feeRule.max_amount != null && raw > feeRule.max_amount;
    return {
      amount,
      breakdown: `${(feeRule.flat_pct_of_turnover * 100).toFixed(2)}% of turnover = ₹${raw.toLocaleString("en-IN")}${capped ? ` (capped at ₹${feeRule.max_amount!.toLocaleString("en-IN")})` : ""}`,
    };
  }

  // CMP-08 (Sec 50) / TDS challan (Sec 201(1A)): interest on unpaid tax/TDS,
  // not a filing late fee. "annual" accrues per day (×days/365), "monthly"
  // per month-or-part (×ceil(days/30)).
  if (feeRule.interest) {
    const { rate, period, on } = feeRule.interest;
    const principal = on === "tds" ? (inputs.tdsAmount ?? 0) : (inputs.taxAmount ?? 0);
    if (daysLate <= 0) return { amount: 0, breakdown: "Paid on time — no interest" };
    if (principal <= 0) return { amount: 0, breakdown: `Enter the ${on === "tds" ? "TDS" : "tax"} amount to compute interest` };
    if (period === "monthly") {
      const months = Math.ceil(daysLate / 30);
      const amount = Math.round(principal * rate * months);
      return { amount, breakdown: `Interest @${(rate * 100).toFixed(1)}%/month × ${months} month(s) on ₹${principal.toLocaleString("en-IN")}` };
    }
    const amount = Math.round(principal * rate * (daysLate / 365));
    return { amount, breakdown: `Interest @${(rate * 100).toFixed(0)}% p.a. × ${daysLate}/365 days on ₹${principal.toLocaleString("en-IN")}` };
  }

  // ADT-1 (Sec 139): MCA additional fee = a normal fee set by nominal share
  // capital × a delay multiplier (Companies (Registration Offices and Fees)
  // Rules) — the multiplier structure AOC-4/MGT-7 left behind in 2018.
  if (feeRule.mca_capital_slab_fee) {
    if (daysLate <= 0) return { amount: 0, breakdown: "Filed on time — no additional fee" };
    const cap = inputs.nominalCapital ?? 0;
    const baseFee = cap < 100_000 ? 200 : cap < 500_000 ? 300 : cap < 2_500_000 ? 400 : cap < 10_000_000 ? 500 : 600;
    const mult = daysLate <= 30 ? 2 : daysLate <= 60 ? 4 : daysLate <= 90 ? 6 : daysLate <= 180 ? 10 : 12;
    const amount = baseFee * mult;
    return { amount, breakdown: `Normal fee ₹${baseFee} (by nominal capital) × ${mult}× additional fee (${daysLate} days late)` };
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

  // PAS-3 (Sec 39(5)): ₹per_day up to a FLAT ₹1,00,000 cap — no turnover
  // scaling, unlike the GST `max` branch just below. Must come first: a rule
  // with hard_max never wants the GST scaling.
  if (feeRule.per_day != null && feeRule.hard_max != null) {
    const amount = Math.min(daysLate * feeRule.per_day, feeRule.hard_max);
    return { amount, breakdown: `₹${feeRule.per_day.toLocaleString("en-IN")}/day × ${daysLate} days (capped at ₹${feeRule.hard_max.toLocaleString("en-IN")})` };
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
