// Hardcoded penalty rules for late filings (illustrative — not legal advice)

export interface PenaltyResult {
  amount: number;
  daysLate: number;
  section: string;
  breakdown: string;
}

// Extra inputs beyond days-late that some filings' real penalty depends on —
// a flat per-filing-type cap is not how GSTR-1/3B/9 or 234B/C actually work.
export interface PenaltyInputs {
  turnover?: number; // annual turnover in rupees, for turnover-slabbed GST late fees
  isNilReturn?: boolean; // GSTR-1/3B nil return: flat ₹20/day, capped ₹500
  incomeBelow5L?: boolean; // ITR 234F: ₹1,000 cap instead of ₹5,000
  actualShortfall?: number; // Advance Tax 234B/234C: real shortfall, not assumed
}

export interface FilingType {
  id: string;
  label: string;
  section: string;
  calculate: (daysLate: number, inputs: PenaltyInputs) => { amount: number; breakdown: string };
}

// GSTR-1/GSTR-3B late fee: turnover-slabbed since FY 2021-22 onward (₹25+₹25
// CGST+SGST per day, capped per slab), or ₹10+₹10 (₹20/day) capped ₹500 for
// a nil return, regardless of turnover.
function gstMonthlyLateFee(d: number, inputs: PenaltyInputs) {
  if (inputs.isNilReturn) {
    const amt = Math.min(d * 20, 500);
    return { amount: amt, breakdown: `Nil return: ₹20/day × ${d} days (capped at ₹500)` };
  }
  const turnover = inputs.turnover ?? 0;
  const cap = turnover <= 15_000_000 ? 2000 : turnover <= 50_000_000 ? 5000 : 10000;
  const amt = Math.min(d * 50, cap);
  const slabLabel = turnover <= 15_000_000 ? "≤₹1.5cr" : turnover <= 50_000_000 ? "₹1.5–5cr" : ">₹5cr";
  return { amount: amt, breakdown: `₹50/day × ${d} days (capped at ₹${cap.toLocaleString("en-IN")} for turnover ${slabLabel})` };
}

export const filingTypes: FilingType[] = [
  {
    id: "gstr3b",
    label: "GSTR-3B (Monthly)",
    section: "Section 47 of CGST Act",
    calculate: gstMonthlyLateFee,
  },
  {
    id: "gstr1",
    label: "GSTR-1 (Outward Supplies)",
    section: "Section 47 of CGST Act",
    calculate: gstMonthlyLateFee,
  },
  {
    id: "gstr9",
    label: "GSTR-9 (Annual Return)",
    section: "Section 47(2) of CGST Act",
    calculate: (d, inputs) => {
      // Notification 07/2023: turnover up to ₹5cr -> ₹50/day, cap 0.04% of
      // turnover; ₹5-20cr -> ₹100/day, same 0.04% cap; above ₹20cr -> ₹200/day,
      // cap 0.50% of turnover.
      const turnover = inputs.turnover ?? 0;
      const perDay = turnover <= 50_000_000 ? 50 : turnover <= 200_000_000 ? 100 : 200;
      const capPct = turnover <= 200_000_000 ? 0.0004 : 0.005;
      const cap = Math.round(turnover * capPct);
      const amt = Math.min(d * perDay, cap);
      return { amount: amt, breakdown: `₹${perDay}/day × ${d} days (capped at ${(capPct * 100).toFixed(2)}% of turnover = ₹${cap.toLocaleString("en-IN")})` };
    },
  },
  {
    id: "itr",
    label: "ITR (Income Tax Return)",
    section: "Section 234F of Income Tax Act",
    calculate: (d, inputs) => {
      const cap = inputs.incomeBelow5L ? 1000 : 5000;
      const amt = d > 0 ? cap : 0;
      return { amount: amt, breakdown: `Flat ₹${cap.toLocaleString("en-IN")} u/s 234F${inputs.incomeBelow5L ? " (total income ≤ ₹5L)" : ""}` };
    },
  },
  {
    id: "tds",
    label: "TDS Return (24Q / 26Q)",
    section: "Section 234E of Income Tax Act",
    calculate: (d) => {
      const perDay = 200;
      const amt = d * perDay;
      return { amount: amt, breakdown: `₹200/day × ${d} days u/s 234E (capped at TDS amount)` };
    },
  },
  {
    id: "roc",
    label: "ROC Annual Filing (AOC-4 / MGT-7)",
    section: "Section 403 of Companies Act, 2013",
    calculate: (d) => {
      const perDay = 100;
      const amt = d * perDay;
      return { amount: amt, breakdown: `₹100/day × ${d} days per form (no upper cap)` };
    },
  },
  {
    id: "advTax",
    label: "Advance Tax Shortfall",
    section: "Section 234B/234C of Income Tax Act",
    calculate: (d, inputs) => {
      const interestRate = 0.01; // 1% per month
      const months = Math.ceil(d / 30);
      const shortfall = inputs.actualShortfall ?? 0;
      const amt = Math.round(shortfall * interestRate * months);
      return { amount: amt, breakdown: `1% × ₹${shortfall.toLocaleString("en-IN")} × ${months} month(s)` };
    },
  },
];

export function calculatePenalty(
  filingId: string,
  dueDate: Date,
  actualDate: Date,
  inputs: PenaltyInputs = {},
): PenaltyResult | null {
  const filing = filingTypes.find((f) => f.id === filingId);
  if (!filing) return null;
  const ms = actualDate.getTime() - dueDate.getTime();
  const daysLate = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  const { amount, breakdown } = filing.calculate(daysLate, inputs);
  return { amount, daysLate, section: filing.section, breakdown };
}
