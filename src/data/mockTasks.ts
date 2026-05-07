export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskType =
  | "GSTR-1" | "GSTR-3B" | "GSTR-9" | "GSTR-9C" | "GSTR-4" | "CMP-08"
  | "ITR Filing" | "Advance Tax" | "Tax Audit" | "Form 3CD" | "Form 26QB"
  | "TDS Challan" | "24Q" | "26Q" | "27Q" | "27EQ" | "Form 16" | "Form 16A" | "Form 27D"
  | "MGT-7" | "AOC-4" | "DIR-3 KYC" | "ADT-1" | "INC-20A" | "PAS-3"
  | "Bookkeeping" | "Payroll" | "GST Registration" | "Company Incorporation" | "Custom";

export interface ChecklistItem {
  id: string;
  label: string;
  received: boolean;
  receivedAt?: string;
  source?: "client_upload" | "manual";
}

export interface Task {
  id: string;
  clientName: string;
  clientId: string;
  taskType: TaskType;
  customTaskName?: string;
  financialYear: string;
  quarter?: string;
  month?: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string;
  assignedInitials: string;
  docsReceived: number;
  docsTotal: number;
  notes?: string;
  documentChecklist?: ChecklistItem[];
}

const sampleChecklists: Record<string, ChecklistItem[]> = {
  "GSTR-3B": [
    { id: "1", label: "Sale invoices for the month", received: true, source: "client_upload", receivedAt: "2026-04-02" },
    { id: "2", label: "Purchase invoices for the month", received: true, source: "client_upload", receivedAt: "2026-04-02" },
    { id: "3", label: "Bank statement", received: false },
    { id: "4", label: "Expense bills", received: false },
    { id: "5", label: "TDS / TCS certificates", received: false },
  ],
  "ITR Filing": [
    { id: "1", label: "Form 16", received: false },
    { id: "2", label: "Bank statements (Apr–Mar)", received: false },
    { id: "3", label: "Investment proofs (LIC/PPF/ELSS)", received: false },
    { id: "4", label: "Home loan interest certificate", received: false },
    { id: "5", label: "Capital gains statement", received: false },
    { id: "6", label: "Last year's ITR", received: false },
  ],
  "GSTR-1": [
    { id: "1", label: "Tax invoices", received: true, source: "client_upload", receivedAt: "2026-03-30" },
    { id: "2", label: "Credit / debit notes", received: true, source: "manual" },
    { id: "3", label: "Export invoices", received: true, source: "manual" },
    { id: "4", label: "B2C summary", received: true, source: "client_upload", receivedAt: "2026-04-01" },
  ],
};

function attachChecklist(task: Omit<Task, "documentChecklist">): Task {
  const items = sampleChecklists[task.taskType];
  return { ...task, documentChecklist: items ? items.map((i) => ({ ...i })) : undefined };
}

export const taskTypeGroups = {
  GST: ["GSTR-1", "GSTR-3B", "GSTR-9", "GSTR-9C", "GSTR-4", "CMP-08"] as TaskType[],
  "Income Tax": ["ITR Filing", "Advance Tax", "Tax Audit", "Form 3CD", "Form 26QB"] as TaskType[],
  TDS: ["TDS Challan", "24Q", "26Q", "27Q", "27EQ", "Form 16", "Form 16A", "Form 27D"] as TaskType[],
  "ROC / MCA": ["MGT-7", "AOC-4", "DIR-3 KYC", "ADT-1", "INC-20A", "PAS-3"] as TaskType[],
  Other: ["Bookkeeping", "Payroll", "GST Registration", "Company Incorporation", "Custom"] as TaskType[],
};

export const taskTypeIcons: Record<string, string> = {
  "GSTR-1": "📊", "GSTR-3B": "📊", "GSTR-9": "📊", "GSTR-9C": "📊", "GSTR-4": "📊", "CMP-08": "📊",
  "ITR Filing": "📋", "Advance Tax": "💰", "Tax Audit": "🔍", "Form 3CD": "📋", "Form 26QB": "📋",
  "TDS Challan": "💳", "24Q": "📑", "26Q": "📑", "27Q": "📑", "27EQ": "📑",
  "Form 16": "📄", "Form 16A": "📄", "Form 27D": "📄",
  "MGT-7": "🏢", "AOC-4": "🏢", "DIR-3 KYC": "🏢", "ADT-1": "🏢", "INC-20A": "🏢", "PAS-3": "🏢",
  "Bookkeeping": "📒", "Payroll": "💼", "GST Registration": "📝", "Company Incorporation": "🏗️", "Custom": "⚡",
};

export const dueDateRules: Record<string, string> = {
  "GSTR-1": "11th of following month",
  "GSTR-3B": "20th of following month (turnover > ₹5cr)",
  "GSTR-9": "31st December of the year",
  "GSTR-4": "30th April",
  "CMP-08": "18th of month following quarter",
  "TDS Challan": "7th of following month (30th April for March)",
  "24Q": "31st of month following quarter end (Q4: 31st May)",
  "26Q": "31st of month following quarter end (Q4: 31st May)",
  "Form 16": "15th June",
  "ITR Filing": "31st July (non-audit) / 31st October (audit cases)",
  "Advance Tax": "15th Jun (15%), 15th Sep (45%), 15th Dec (75%), 15th Mar (100%)",
  "DIR-3 KYC": "30th September each year",
  "MGT-7": "60 days from AGM date",
  "AOC-4": "30 days from AGM date",
};

export const staffMembers = [
  { name: "CA Rajesh Sharma", initials: "RS" },
  { name: "Priya Verma", initials: "PV" },
  { name: "Amit Joshi", initials: "AJ" },
  { name: "Neha Patel", initials: "NP" },
];

export const financialYears = ["FY 2022-23", "FY 2023-24", "FY 2024-25", "FY 2025-26"];
export const quarters = ["Q1 (Apr-Jun)", "Q2 (Jul-Sep)", "Q3 (Oct-Dec)", "Q4 (Jan-Mar)"];
export const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];

export const mockTasks: Task[] = [
  {
    id: "t1", clientName: "Ramesh Gupta", clientId: "c1", taskType: "GSTR-3B",
    financialYear: "FY 2025-26", month: "March", dueDate: "2026-04-20",
    priority: "high", status: "pending", assignedTo: "CA Rajesh Sharma", assignedInitials: "RS",
    docsReceived: 2, docsTotal: 5,
  },
  {
    id: "t2", clientName: "Priya Sharma", clientId: "c2", taskType: "ITR Filing",
    financialYear: "FY 2025-26", dueDate: "2026-07-31",
    priority: "medium", status: "pending", assignedTo: "Priya Verma", assignedInitials: "PV",
    docsReceived: 0, docsTotal: 6,
  },
  {
    id: "t3", clientName: "Mehta Traders", clientId: "c3", taskType: "GSTR-1",
    financialYear: "FY 2025-26", month: "March", dueDate: "2026-04-11",
    priority: "urgent", status: "in_progress", assignedTo: "Amit Joshi", assignedInitials: "AJ",
    docsReceived: 4, docsTotal: 4,
  },
  {
    id: "t4", clientName: "Sunrise Pvt Ltd", clientId: "c4", taskType: "TDS Challan",
    financialYear: "FY 2025-26", month: "March", dueDate: "2026-04-07",
    priority: "urgent", status: "in_progress", assignedTo: "Neha Patel", assignedInitials: "NP",
    docsReceived: 3, docsTotal: 3, notes: "Salary TDS for March. Challan amount: ₹45,000",
  },
  {
    id: "t5", clientName: "Anita Desai", clientId: "c5", taskType: "Advance Tax",
    financialYear: "FY 2025-26", quarter: "Q4 (Jan-Mar)", dueDate: "2026-03-15",
    priority: "high", status: "completed", assignedTo: "CA Rajesh Sharma", assignedInitials: "RS",
    docsReceived: 2, docsTotal: 2, notes: "4th instalment paid. Challan ref: BSR-2026-1234",
  },
  {
    id: "t6", clientName: "Kumar & Sons", clientId: "c6", taskType: "26Q",
    financialYear: "FY 2025-26", quarter: "Q4 (Jan-Mar)", dueDate: "2026-05-31",
    priority: "medium", status: "pending", assignedTo: "Priya Verma", assignedInitials: "PV",
    docsReceived: 1, docsTotal: 4,
  },
  {
    id: "t7", clientName: "Vikram Industries LLP", clientId: "c7", taskType: "MGT-7",
    financialYear: "FY 2024-25", dueDate: "2025-11-28",
    priority: "low", status: "completed", assignedTo: "Amit Joshi", assignedInitials: "AJ",
    docsReceived: 5, docsTotal: 5,
  },
  {
    id: "t8", clientName: "Deepak Agarwal", clientId: "c8", taskType: "GSTR-3B",
    financialYear: "FY 2025-26", month: "March", dueDate: "2026-04-20",
    priority: "medium", status: "in_progress", assignedTo: "Neha Patel", assignedInitials: "NP",
    docsReceived: 3, docsTotal: 5,
  },
  {
    id: "t9", clientName: "Shree Ganesh Traders", clientId: "c9", taskType: "GSTR-1",
    financialYear: "FY 2025-26", month: "February", dueDate: "2026-03-11",
    priority: "high", status: "completed", assignedTo: "CA Rajesh Sharma", assignedInitials: "RS",
    docsReceived: 4, docsTotal: 4,
  },
  {
    id: "t10", clientName: "Patel Constructions", clientId: "c10", taskType: "Form 26QB",
    financialYear: "FY 2025-26", dueDate: "2026-04-30",
    priority: "low", status: "pending", assignedTo: "Amit Joshi", assignedInitials: "AJ",
    docsReceived: 0, docsTotal: 3,
  },
  {
    id: "t11", clientName: "Ramesh Gupta", clientId: "c1", taskType: "DIR-3 KYC",
    financialYear: "FY 2025-26", dueDate: "2026-09-30",
    priority: "low", status: "pending", assignedTo: "Priya Verma", assignedInitials: "PV",
    docsReceived: 0, docsTotal: 2,
  },
  {
    id: "t12", clientName: "Sunrise Pvt Ltd", clientId: "c4", taskType: "AOC-4",
    financialYear: "FY 2024-25", dueDate: "2025-10-30",
    priority: "medium", status: "completed", assignedTo: "Neha Patel", assignedInitials: "NP",
    docsReceived: 6, docsTotal: 6,
  },
];
