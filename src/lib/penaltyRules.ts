// UI metadata + the DB-rule-driven calculation this delegates to.
// The actual late-fee formulas live in compliance_rules (see
// src/data/ComplianceRules.ts) — this file only maps a dropdown id to a
// filing_type and handles Advance Tax, which is interest-based (not a
// per-day late-fee shape) and so isn't modeled as a compliance_rules row.

import { ComplianceRule, computeLateFee, PenaltyInputs } from "@/data/ComplianceRules";

export type { PenaltyInputs };

export interface PenaltyResult {
  amount: number;
  daysLate: number;
  section: string;
  breakdown: string;
}

export interface FilingTypeMeta {
  id: string;
  label: string;
  filingType: string | null; // null for Advance Tax, calculated separately below
}

export const filingTypes: FilingTypeMeta[] = [
  { id: "gstr3b", label: "GSTR-3B (Monthly)", filingType: "GSTR-3B_MONTHLY_ABOVE5CR" },
  { id: "gstr1", label: "GSTR-1 (Outward Supplies)", filingType: "GSTR-1_MONTHLY" },
  { id: "gstr9", label: "GSTR-9 (Annual Return)", filingType: "GSTR-9" },
  { id: "itr", label: "ITR (Income Tax Return)", filingType: "ITR_NON_AUDIT" },
  { id: "tds", label: "TDS Return (24Q / 26Q)", filingType: "TDS_RETURN_24Q_26Q" },
  { id: "roc", label: "ROC Annual Filing (AOC-4 / MGT-7)", filingType: "ROC_ANNUAL_FILING" },
  { id: "advTax", label: "Advance Tax Shortfall", filingType: null },
];

const SECTION_LABELS: Record<string, string> = {
  gstr3b: "Section 47 of CGST Act",
  gstr1: "Section 47 of CGST Act",
  gstr9: "Section 47(2) of CGST Act",
  itr: "Section 234F of Income Tax Act",
  tds: "Section 234E of Income Tax Act",
  roc: "Section 403 of Companies Act, 2013",
  advTax: "Section 234B/234C of Income Tax Act",
};

export function calculatePenalty(
  filingId: string,
  dueDate: Date,
  actualDate: Date,
  inputs: PenaltyInputs,
  rules: ComplianceRule[],
): PenaltyResult | null {
  const meta = filingTypes.find((f) => f.id === filingId);
  if (!meta) return null;

  const ms = actualDate.getTime() - dueDate.getTime();
  const daysLate = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  const section = SECTION_LABELS[filingId] ?? "";

  if (filingId === "advTax") {
    const interestRate = 0.01; // 1% per month
    const months = Math.ceil(daysLate / 30);
    const shortfall = inputs.actualShortfall ?? 0;
    const amount = Math.round(shortfall * interestRate * months);
    return { amount, daysLate, section, breakdown: `1% × ₹${shortfall.toLocaleString("en-IN")} × ${months} month(s)` };
  }

  const rule = rules.find((r) => r.filingType === meta.filingType);
  if (!rule) return null;

  const result = computeLateFee(rule, daysLate, inputs);
  if (!result) return null;
  return { amount: result.amount, daysLate, section, breakdown: result.breakdown };
}
