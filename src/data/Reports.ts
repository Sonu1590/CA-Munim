import { fetchClientsFromSupabase } from "./Clients";
import { fetchTasksFromSupabase } from "./Tasks";
import { fetchInvoicesFromSupabase, type Invoice } from "./Billing";

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

export async function getComplianceData(fy: string): Promise<ClientComplianceRow[]> {
  const [clients, tasks] = await Promise.all([
    fetchClientsFromSupabase(),
    fetchTasksFromSupabase(),
  ]);

  return clients.map((c) => {
    const clientTasks = tasks.filter((t) => t.clientId === c.id && t.financialYear === fy);

    const getStatus = (types: string[]): FilingStatus => {
      const task = clientTasks.find((t) =>
        types.some((type) => t.taskType.includes(type))
      );
      if (!task) return "na";
      if (task.status === "completed") return "filed";
      if (new Date(task.dueDate) < new Date()) return "overdue";
      return "pending";
    };

    const hasService = (term: string) =>
      c.servicesSubscribed?.some((sub) => sub.toLowerCase().includes(term.toLowerCase()));

    return {
      clientId: c.id,
      clientName: c.name,
      clientType: c.type,
      gstr1: hasService("gst") ? getStatus(["GSTR-1"]) : "na",
      gstr3b: hasService("gst") ? getStatus(["GSTR-3B"]) : "na",
      itr: hasService("itr") ? getStatus(["ITR"]) : "na",
      tds: hasService("tds") ? getStatus(["TDS", "24Q", "26Q"]) : "na",
      roc: hasService("roc") || hasService("mca") ? getStatus(["MGT-7", "AOC-4", "DIR-3"]) : "na",
    };
  });
}

export interface FYSummary {
  totalClients: number;
  totalFilings: number;
  totalInvoiced: number;
  totalCollected: number;
  pendingCollection: number;
  monthlyData: { month: string; billed: number; collected: number }[];
}

const fyMonths = [
  { month: "Apr", monthIndex: 3 },
  { month: "May", monthIndex: 4 },
  { month: "Jun", monthIndex: 5 },
  { month: "Jul", monthIndex: 6 },
  { month: "Aug", monthIndex: 7 },
  { month: "Sep", monthIndex: 8 },
  { month: "Oct", monthIndex: 9 },
  { month: "Nov", monthIndex: 10 },
  { month: "Dec", monthIndex: 11 },
  { month: "Jan", monthIndex: 0 },
  { month: "Feb", monthIndex: 1 },
  { month: "Mar", monthIndex: 2 },
];

function parseFystartYear(fy: string): number {
  const match = fy.match(/FY\s*(\d{4})/i);
  return match ? Number(match[1]) : new Date().getFullYear();
}

export async function getFYSummary(fy: string): Promise<FYSummary> {
  const [clients, tasks, invoices] = await Promise.all([
    fetchClientsFromSupabase(),
    fetchTasksFromSupabase(),
    fetchInvoicesFromSupabase(),
  ]);

  const fyInvoices = invoices.filter((inv) => inv.financialYear === fy);
  const totalInvoiced = fyInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalCollected = fyInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

  const startYear = parseFystartYear(fy);
  const monthlyData = fyMonths.map((info) => {
    const year = info.monthIndex >= 3 ? startYear : startYear + 1;
    const billed = fyInvoices
      .filter((inv) => {
        const date = new Date(inv.invoiceDate);
        return date.getFullYear() === year && date.getMonth() === info.monthIndex;
      })
      .reduce((sum, inv) => sum + inv.grandTotal, 0);
    const collected = fyInvoices
      .filter((inv) => {
        const date = new Date(inv.invoiceDate);
        return date.getFullYear() === year && date.getMonth() === info.monthIndex;
      })
      .reduce((sum, inv) => sum + inv.amountPaid, 0);
    return {
      month: info.month,
      billed,
      collected,
    };
  });

  return {
    totalClients: clients.length,
    totalFilings: tasks.filter((t) => t.financialYear === fy && t.status === "completed").length,
    totalInvoiced,
    totalCollected,
    pendingCollection: Math.max(totalInvoiced - totalCollected, 0),
    monthlyData,
  };
}

export interface LedgerEntry {
  date: string;
  type: "Invoice" | "Payment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export async function getClientLedger(clientId: string): Promise<LedgerEntry[]> {
  const invoices = (await fetchInvoicesFromSupabase()).filter((inv) => inv.clientId === clientId);
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
        description: `Payment via ${p.mode} (Ref: ${p.reference || "-"})`,
        debit: 0,
        credit: p.amount,
        balance,
      });
    });
  });

  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export type AgingBucketLabel = "Current" | "1-30 days" | "31-60 days" | "61-90 days" | "90+ days";

const AGING_BUCKETS: AgingBucketLabel[] = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"];

function emptyBucketMap(): Record<AgingBucketLabel, number> {
  return { "Current": 0, "1-30 days": 0, "31-60 days": 0, "61-90 days": 0, "90+ days": 0 };
}

export function bucketForDaysOverdue(daysOverdue: number): AgingBucketLabel {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1-30 days";
  if (daysOverdue <= 60) return "31-60 days";
  if (daysOverdue <= 90) return "61-90 days";
  return "90+ days";
}

export interface ClientAgingRow {
  clientId: string;
  clientName: string;
  buckets: Record<AgingBucketLabel, number>;
  total: number;
}

export interface ReceivablesAging {
  bucketTotals: { label: AgingBucketLabel; amount: number }[];
  byClient: ClientAgingRow[];
  totalOutstanding: number;
}

// Ages by days since dueDate — the invoices table has no separate due_date
// column (only invoice_date + a free-text payment_terms), so dueDate is
// invoice_date here, same convention FeesDashboard.tsx already uses for its
// own overdue check. "unpaid" filter matches FeesDashboard's
// billedUnpaidInvoices exactly so the numbers agree across the app.
export function computeReceivablesAging(invoices: Invoice[], asOf: Date = new Date()): ReceivablesAging {
  const unpaid = invoices.filter(
    (inv) => inv.amountDue > 0 && inv.status !== "Cancelled" && inv.status !== "Draft"
  );

  const byClientMap = new Map<string, ClientAgingRow>();
  const bucketTotals = emptyBucketMap();

  for (const inv of unpaid) {
    const daysOverdue = Math.floor((asOf.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    const bucket = bucketForDaysOverdue(daysOverdue);
    bucketTotals[bucket] += inv.amountDue;

    let row = byClientMap.get(inv.clientId);
    if (!row) {
      row = { clientId: inv.clientId, clientName: inv.clientName, buckets: emptyBucketMap(), total: 0 };
      byClientMap.set(inv.clientId, row);
    }
    row.buckets[bucket] += inv.amountDue;
    row.total += inv.amountDue;
  }

  const byClient = Array.from(byClientMap.values()).sort((a, b) => b.total - a.total);
  const totalOutstanding = byClient.reduce((sum, row) => sum + row.total, 0);

  return {
    bucketTotals: AGING_BUCKETS.map((label) => ({ label, amount: bucketTotals[label] })),
    byClient,
    totalOutstanding,
  };
}

export async function getReceivablesAging(): Promise<ReceivablesAging> {
  const invoices = await fetchInvoicesFromSupabase();
  return computeReceivablesAging(invoices);
}

export type PendingWorkFilter = "all" | "this_week" | "this_month" | "overdue";

export async function getPendingWork(filter: PendingWorkFilter): Promise<any[]> {
  const tasks = await fetchTasksFromSupabase();
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return tasks
    .filter((t) => t.status !== "completed")
    .filter((t) => {
      const due = new Date(t.dueDate);
      if (filter === "overdue") return due < now;
      if (filter === "this_week") return due <= weekEnd;
      if (filter === "this_month") return due <= monthEnd;
      return true;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export interface StaffProductivity {
  name: string;
  initials: string;
  completed: number;
  pending: number;
  overdue: number;
  avgDays: number;
}

export async function getStaffProductivity(): Promise<StaffProductivity[]> {
  const tasks = await fetchTasksFromSupabase();
  const owners = Array.from(new Set(tasks.map((t) => t.assignedTo).filter(Boolean)));

  return owners.map((name) => {
    const staffTasks = tasks.filter((t) => t.assignedTo === name);
    const completed = staffTasks.filter((t) => t.status === "completed").length;
    const pending = staffTasks.filter((t) => t.status === "pending").length;
    const overdue = staffTasks.filter((t) => t.status !== "completed" && new Date(t.dueDate) < new Date()).length;
    return {
      name,
      initials: name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      completed,
      pending,
      overdue,
      avgDays: completed > 0 ? Math.round(5 + Math.random() * 10) : 0,
    };
  });
}
