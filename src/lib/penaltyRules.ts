// Hardcoded penalty rules for late filings (illustrative — not legal advice)

export interface PenaltyResult {
  amount: number;
  daysLate: number;
  section: string;
  breakdown: string;
}

export interface FilingType {
  id: string;
  label: string;
  section: string;
  calculate: (daysLate: number) => { amount: number; breakdown: string };
}

export const filingTypes: FilingType[] = [
  {
    id: "gstr3b",
    label: "GSTR-3B (Monthly)",
    section: "Section 47 of CGST Act",
    calculate: (d) => {
      const perDay = 50; // ₹25 CGST + ₹25 SGST (with tax liability)
      const cap = 5000;
      const amt = Math.min(d * perDay, cap);
      return { amount: amt, breakdown: `₹50/day × ${d} days (capped at ₹5,000)` };
    },
  },
  {
    id: "gstr1",
    label: "GSTR-1 (Outward Supplies)",
    section: "Section 47 of CGST Act",
    calculate: (d) => {
      const perDay = 50;
      const cap = 5000;
      const amt = Math.min(d * perDay, cap);
      return { amount: amt, breakdown: `₹50/day × ${d} days (capped at ₹5,000)` };
    },
  },
  {
    id: "gstr9",
    label: "GSTR-9 (Annual Return)",
    section: "Section 47(2) of CGST Act",
    calculate: (d) => {
      const perDay = 200; // ₹100 CGST + ₹100 SGST
      const amt = d * perDay;
      return { amount: amt, breakdown: `₹200/day × ${d} days (subject to 0.50% turnover cap)` };
    },
  },
  {
    id: "itr",
    label: "ITR (Income Tax Return)",
    section: "Section 234F of Income Tax Act",
    calculate: (d) => {
      // Flat ₹5,000 if filed after due date (₹1,000 if income < ₹5L)
      const amt = d > 0 ? 5000 : 0;
      return { amount: amt, breakdown: `Flat ₹5,000 u/s 234F (₹1,000 if total income ≤ ₹5L)` };
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
    calculate: (d) => {
      const interestRate = 0.01; // 1% per month
      const months = Math.ceil(d / 30);
      const assumedShortfall = 100000;
      const amt = Math.round(assumedShortfall * interestRate * months);
      return { amount: amt, breakdown: `1% × ₹1,00,000 (assumed) × ${months} month(s)` };
    },
  },
];

export function calculatePenalty(
  filingId: string,
  dueDate: Date,
  actualDate: Date,
): PenaltyResult | null {
  const filing = filingTypes.find((f) => f.id === filingId);
  if (!filing) return null;
  const ms = actualDate.getTime() - dueDate.getTime();
  const daysLate = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  const { amount, breakdown } = filing.calculate(daysLate);
  return { amount, daysLate, section: filing.section, breakdown };
}
