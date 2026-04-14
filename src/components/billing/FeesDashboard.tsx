import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Invoice } from "@/data/mockBilling";
import { IndianRupee, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface FeesDashboardProps {
  invoices: Invoice[];
}

export function FeesDashboard({ invoices }: FeesDashboardProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthInvoices = invoices.filter((inv) => {
    const d = new Date(inv.invoiceDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalInvoicedThisMonth = thisMonthInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalReceivedThisMonth = thisMonthInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.amountDue, 0);
  const overdueInvoices = invoices.filter(
    (i) => i.status === "Overdue" || (i.amountDue > 0 && new Date(i.dueDate) < now && i.status !== "Cancelled")
  );

  const unpaidInvoices = invoices
    .filter((i) => i.amountDue > 0 && i.status !== "Cancelled" && i.status !== "Draft")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const metrics = [
    {
      label: "Invoiced This Month",
      value: `₹${totalInvoicedThisMonth.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Received This Month",
      value: `₹${totalReceivedThisMonth.toLocaleString("en-IN")}`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total Outstanding",
      value: `₹${totalOutstanding.toLocaleString("en-IN")}`,
      icon: Clock,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Overdue Invoices",
      value: overdueInvoices.length.toString(),
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${m.bg}`}>
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-heading font-bold mt-0.5">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outstanding invoices list */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-heading font-semibold mb-3">Outstanding Invoices</h3>
          {unpaidInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No outstanding invoices 🎉</p>
          ) : (
            <div className="space-y-2">
              {unpaidInvoices.map((inv) => {
                const isOverdue = new Date(inv.dueDate) < now;
                return (
                  <div
                    key={inv.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border ${
                      isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{inv.clientName}</span>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inv.invoiceNumber} • Due: {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-heading font-bold text-sm">
                        ₹{inv.amountDue.toLocaleString("en-IN")}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => toast.success(`Reminder sent to ${inv.clientName}`)}
                      >
                        Send Reminder
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
