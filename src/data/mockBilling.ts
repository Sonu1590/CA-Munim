export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Partially Paid" | "Overdue" | "Cancelled";
export type PaymentMode = "UPI" | "NEFT" | "RTGS" | "IMPS" | "Cash" | "Cheque" | "Demand Draft";

export interface InvoiceLineItem {
  id: string;
  description: string;
  sacCode: string;
  amount: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientState: string;
  invoiceDate: string;
  dueDate: string;
  financialYear: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  gstApplicable: boolean;
  isSameState: boolean;
  status: InvoiceStatus;
  payments: Payment[];
  amountPaid: number;
  amountDue: number;
  notes?: string;
}

export const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV-2526-0001",
    clientId: "1",
    clientName: "Ramesh Kumar Gupta",
    clientState: "Maharashtra",
    invoiceDate: "2025-04-05",
    dueDate: "2025-04-20",
    financialYear: "FY 2025-26",
    lineItems: [
      { id: "li-1", description: "ITR Filing — FY 2024-25", sacCode: "998231", amount: 5000 },
      { id: "li-2", description: "Form 16 Preparation", sacCode: "998231", amount: 2000 },
    ],
    subtotal: 7000,
    cgst: 630,
    sgst: 630,
    igst: 0,
    grandTotal: 8260,
    gstApplicable: true,
    isSameState: true,
    status: "Paid",
    payments: [
      { id: "pay-1", invoiceId: "inv-1", date: "2025-04-18", amount: 8260, mode: "UPI", reference: "UPI123456789" },
    ],
    amountPaid: 8260,
    amountDue: 0,
    notes: "Payment received on time.",
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-2526-0002",
    clientId: "2",
    clientName: "Mehta Traders",
    clientState: "Maharashtra",
    invoiceDate: "2025-04-08",
    dueDate: "2025-04-25",
    financialYear: "FY 2025-26",
    lineItems: [
      { id: "li-3", description: "Monthly GST Return Filing — April 2025", sacCode: "998231", amount: 3000 },
      { id: "li-4", description: "TDS Return Filing — Q4 FY24-25", sacCode: "998231", amount: 2500 },
      { id: "li-5", description: "Bookkeeping — April 2025", sacCode: "998231", amount: 5000 },
    ],
    subtotal: 10500,
    cgst: 945,
    sgst: 945,
    igst: 0,
    grandTotal: 12390,
    gstApplicable: true,
    isSameState: true,
    status: "Partially Paid",
    payments: [
      { id: "pay-2", invoiceId: "inv-2", date: "2025-04-20", amount: 5000, mode: "NEFT", reference: "NEFT987654321" },
    ],
    amountPaid: 5000,
    amountDue: 7390,
  },
  {
    id: "inv-3",
    invoiceNumber: "INV-2526-0003",
    clientId: "4",
    clientName: "Sunrise Technologies Pvt Ltd",
    clientState: "Karnataka",
    invoiceDate: "2025-03-15",
    dueDate: "2025-03-31",
    financialYear: "FY 2024-25",
    lineItems: [
      { id: "li-6", description: "GST Return Filing — March 2025", sacCode: "998231", amount: 5000 },
      { id: "li-7", description: "ROC Annual Filing — FY 2024-25", sacCode: "998231", amount: 15000 },
      { id: "li-8", description: "Tax Audit — FY 2024-25", sacCode: "998231", amount: 25000 },
    ],
    subtotal: 45000,
    cgst: 0,
    sgst: 0,
    igst: 8100,
    grandTotal: 53100,
    gstApplicable: true,
    isSameState: false,
    status: "Overdue",
    payments: [],
    amountPaid: 0,
    amountDue: 53100,
  },
  {
    id: "inv-4",
    invoiceNumber: "INV-2526-0004",
    clientId: "3",
    clientName: "Priya Sharma",
    clientState: "Delhi",
    invoiceDate: "2025-04-10",
    dueDate: "2025-04-30",
    financialYear: "FY 2025-26",
    lineItems: [
      { id: "li-9", description: "ITR-1 Filing — FY 2024-25", sacCode: "998231", amount: 2000 },
    ],
    subtotal: 2000,
    cgst: 0,
    sgst: 0,
    igst: 360,
    grandTotal: 2360,
    gstApplicable: true,
    isSameState: false,
    status: "Sent",
    payments: [],
    amountPaid: 0,
    amountDue: 2360,
  },
  {
    id: "inv-5",
    invoiceNumber: "INV-2526-0005",
    clientId: "6",
    clientName: "Patel Associates LLP",
    clientState: "Gujarat",
    invoiceDate: "2025-04-12",
    dueDate: "2025-05-10",
    financialYear: "FY 2025-26",
    lineItems: [
      { id: "li-10", description: "GST Return Filing — April 2025", sacCode: "998231", amount: 4000 },
      { id: "li-11", description: "ROC Compliance — Annual Return", sacCode: "998231", amount: 10000 },
    ],
    subtotal: 14000,
    cgst: 0,
    sgst: 0,
    igst: 2520,
    grandTotal: 16520,
    gstApplicable: true,
    isSameState: false,
    status: "Draft",
    payments: [],
    amountPaid: 0,
    amountDue: 16520,
  },
  {
    id: "inv-6",
    invoiceNumber: "INV-2526-0006",
    clientId: "7",
    clientName: "Anil Joshi",
    clientState: "Maharashtra",
    invoiceDate: "2025-03-20",
    dueDate: "2025-04-05",
    financialYear: "FY 2024-25",
    lineItems: [
      { id: "li-12", description: "GST Return Filing — March 2025", sacCode: "998231", amount: 2500 },
      { id: "li-13", description: "ITR-4 Filing — FY 2024-25", sacCode: "998231", amount: 3500 },
    ],
    subtotal: 6000,
    cgst: 540,
    sgst: 540,
    igst: 0,
    grandTotal: 7080,
    gstApplicable: true,
    isSameState: true,
    status: "Overdue",
    payments: [
      { id: "pay-3", invoiceId: "inv-6", date: "2025-04-01", amount: 3000, mode: "Cash", reference: "CASH-001" },
    ],
    amountPaid: 3000,
    amountDue: 4080,
  },
  {
    id: "inv-7",
    invoiceNumber: "INV-2526-0007",
    clientId: "5",
    clientName: "Gupta & Sons HUF",
    clientState: "Rajasthan",
    invoiceDate: "2025-04-14",
    dueDate: "2025-05-15",
    financialYear: "FY 2025-26",
    lineItems: [
      { id: "li-14", description: "ITR Filing — FY 2024-25", sacCode: "998231", amount: 3000 },
      { id: "li-15", description: "Bookkeeping — April 2025", sacCode: "998231", amount: 4000 },
    ],
    subtotal: 7000,
    cgst: 0,
    sgst: 0,
    igst: 1260,
    grandTotal: 8260,
    gstApplicable: true,
    isSameState: false,
    status: "Sent",
    payments: [],
    amountPaid: 0,
    amountDue: 8260,
  },
];
