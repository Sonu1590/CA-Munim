import { mockClients } from "./mockClients";
import { mockTasks, staffMembers } from "./mockTasks";
import { mockInvoices } from "./mockBilling";

// Report 1: Client Compliance Status
export type FilingStatus = "filed" | "pending" | "overdue" | "na";

export interface ClientComplianceRow {
  clientId: string;
  clientName: string;
  clientType: string;
  gstr1: FilingStatus;
  gstr3b: FilingStatus;
  itr: FilingStatus;
  tds: FilingStatus;
  roc: FilingStatus;
}

export function getComplianceData(fy: string): ClientComplianceRow[] {
  return mockClients.map((c) => {
    const clientTasks = mockTasks.filter(
      (t) => t.clientId === c.id || t.clientName.includes(c.name.split(" ")[0])
    );
    const getStatus = (types: string[]): FilingStatus => {
      const task = clientTasks.find((t) =>
        types.some((type) => t.taskType.includes(type))
      );
      if (!task) return "na";
      if (task.status === "completed") return "filed";
      if (new Date(task.dueDate) < new Date()) return "overdue";
      return "pending";
    };
    const hasService = (s: string) => c.servicesSubscribed.some((sub) => sub.includes(s));
    return {
      clientId: c.id,
      clientName: c.name,
      clientType: c.type,
      gstr1: hasService("GST") ? getStatus(["GSTR-1"]) : "na",
      gstr3b: hasService("GST") ? getStatus(["GSTR-3B"]) : "na",
      itr: hasService("ITR") ? getStatus(["ITR"]) : "na",
      tds: hasService("TDS") ? getStatus(["TDS", "24Q", "26Q"]) : "na",
      roc: hasService("ROC") ? getStatus(["MGT-7", "AOC-4", "DIR-3"]) : "na",
    };
  });
}

// Report 3: FY Summary
export interface FYSummary {
  totalClients: number;
  totalFilings: number;
  totalInvoiced: number;
  totalCollected: number;
  pendingCollection: number;
  monthlyData: { month: string; billed: number; collected: number }[];
}

export function getFYSummary(_fy: string): FYSummary {
  const totalInvoiced = mockInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalCollected = mockInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  return {
    totalClients: mockClients.length,
    totalFilings: mockTasks.filter((t) => t.status === "completed").length,
    totalInvoiced,
    totalCollected,
    pendingCollection: totalInvoiced - totalCollected,
    monthlyData: months.map((m, i) => ({
      month: m,
      billed: i < 2 ? Math.round(totalInvoiced * (0.06 + Math.random() * 0.1)) : 0,
      collected: i < 2 ? Math.round(totalCollected * (0.06 + Math.random() * 0.1)) : 0,
    })),
  };
}

// Report 4: Client Ledger
export interface LedgerEntry {
  date: string;
  type: "Invoice" | "Payment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export function getClientLedger(clientId: string): LedgerEntry[] {
  const invoices = mockInvoices.filter((i) => i.clientId === clientId);
  const entries: LedgerEntry[] = [];
  let balance = 0;
  invoices.forEach((inv) => {
    balance += inv.grandTotal;
    entries.push({
      date: inv.invoiceDate,
      type: "Invoice",
      description: `${inv.invoiceNumber} — ${inv.lineItems.map((l) => l.description).join(", ")}`,
      debit: inv.grandTotal,
      credit: 0,
      balance,
    });
    inv.payments.forEach((p) => {
      balance -= p.amount;
      entries.push({
        date: p.date,
        type: "Payment",
        description: `Payment via ${p.mode} (Ref: ${p.reference})`,
        debit: 0,
        credit: p.amount,
        balance,
      });
    });
  });
  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Report 6: Staff Productivity
export interface StaffProductivity {
  name: string;
  initials: string;
  completed: number;
  pending: number;
  overdue: number;
  avgDays: number;
}

export function getStaffProductivity(): StaffProductivity[] {
  return staffMembers.map((s) => {
    const tasks = mockTasks.filter((t) => t.assignedTo === s.name);
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const overdue = tasks.filter(
      (t) => t.status !== "completed" && new Date(t.dueDate) < new Date()
    ).length;
    return {
      name: s.name,
      initials: s.initials,
      completed,
      pending,
      overdue,
      avgDays: completed > 0 ? Math.round(5 + Math.random() * 10) : 0,
    };
  });
}
