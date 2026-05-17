import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Users, ClipboardList, Receipt, Archive } from "lucide-react";
import { toast } from "sonner";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { fetchInvoicesFromSupabase } from "@/data/Billing";
import { useTasks } from "@/hooks/useTasks";
import { downloadCsv, downloadExcelTable, downloadTextFile, formatDateIN, formatINR } from "@/lib/downloads";

const exports = [
  { key: "clients", label: "Export All Clients", desc: "Download client master list with all details", icon: Users, format: "CSV" },
  { key: "tasks", label: "Export All Tasks", desc: "Download complete task history with statuses", icon: ClipboardList, format: "Excel" },
  { key: "invoices", label: "Export All Invoices", desc: "Download invoice register with payment status", icon: Receipt, format: "CSV" },
];

export function DataExport() {
  const { tasks } = useTasks();

  const handleExport = async (key: string) => {
    try {
      if (key === "clients") {
        const clients = await fetchClientsFromSupabase();
        downloadCsv("clients-master-list.csv", clients, [
          { header: "Client Name", value: (c) => c.name },
          { header: "Type", value: (c) => c.type },
          { header: "PAN", value: (c) => c.pan },
          { header: "GSTIN", value: (c) => c.gstin ?? "" },
          { header: "Phone", value: (c) => c.phone },
          { header: "Email", value: (c) => c.email },
          { header: "City", value: (c) => c.city },
          { header: "State", value: (c) => c.state },
          { header: "Services", value: (c) => c.servicesSubscribed.join(", ") },
          { header: "Open Tasks", value: (c) => c.activeTasks },
          { header: "Pending Fees", value: (c) => formatINR(c.pendingFees) },
          { header: "Last Activity", value: (c) => formatDateIN(c.lastActivity) },
        ]);
        toast.success("Client master CSV downloaded");
        return;
      }

      if (key === "tasks") {
        downloadExcelTable("task-history.xls", "Complete Task History", tasks, [
          { header: "Client", value: (t) => t.clientName },
          { header: "Task", value: (t) => t.customName || t.taskType },
          { header: "FY", value: (t) => t.financialYear, align: "center" },
          { header: "Period", value: (t) => t.period || "-", align: "center" },
          { header: "Due Date", value: (t) => formatDateIN(t.dueDate), align: "center" },
          { header: "Priority", value: (t) => t.priority, align: "center" },
          { header: "Status", value: (t) => t.status.replace("_", " "), align: "center" },
          { header: "Assigned To", value: (t) => t.assignedToName ?? "Unassigned" },
          { header: "Documents", value: (t) => `${t.documentChecklist.filter((d: any) => d.received || d.checked).length}/${t.documentChecklist.length}`, align: "center" },
          { header: "Notes", value: (t) => t.notes ?? "" },
        ]);
        toast.success("Task history Excel file downloaded");
        return;
      }

      const invoices = await fetchInvoicesFromSupabase();
      downloadCsv("invoice-register.csv", invoices, [
        { header: "Invoice No", value: (i) => i.invoiceNumber },
        { header: "Client", value: (i) => i.clientName },
        { header: "Invoice Date", value: (i) => formatDateIN(i.invoiceDate) },
        { header: "Due Date", value: (i) => formatDateIN(i.dueDate) },
        { header: "FY", value: (i) => i.financialYear },
        { header: "Subtotal", value: (i) => formatINR(i.subtotal) },
        { header: "CGST", value: (i) => formatINR(i.cgst) },
        { header: "SGST", value: (i) => formatINR(i.sgst) },
        { header: "IGST", value: (i) => formatINR(i.igst) },
        { header: "Total", value: (i) => formatINR(i.grandTotal) },
        { header: "Paid", value: (i) => formatINR(i.amountPaid) },
        { header: "Due", value: (i) => formatINR(i.amountDue) },
        { header: "Status", value: (i) => i.status },
      ]);
      toast.success("Invoice register CSV downloaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Export failed");
    }
  };

  const handleBackup = async () => {
    try {
      const [clients, exportedTasks, invoices] = await Promise.all([
        fetchClientsFromSupabase(),
        Promise.resolve(tasks),
        fetchInvoicesFromSupabase(),
      ]);
      downloadTextFile(
        "ca-munim-backup.json",
        JSON.stringify({ exportedAt: new Date().toISOString(), clients, tasks: exportedTasks, invoices }, null, 2),
        "application/json;charset=utf-8",
      );
      toast.success("Backup JSON downloaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Backup export failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Data & Export</h3>
        <p className="text-sm text-muted-foreground">Export your data or request a full backup</p>
      </div>

      <div className="grid gap-4">
        {exports.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport(item.key)}>
                <Download className="h-4 w-4" />{item.format}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Archive className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium">Request Full Data Backup</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Download a JSON backup containing clients, tasks, and invoices</p>
          <Button variant="outline" className="gap-2" onClick={handleBackup}>
            <Download className="h-4 w-4" />Request Backup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
