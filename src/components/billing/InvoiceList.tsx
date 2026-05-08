import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Invoice } from "@/data/Billing";
import { Eye, Download, MessageCircle, CreditCard } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface InvoiceListProps {
  invoices: Invoice[];
  onRecordPayment: (invoice: Invoice) => void;
}

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  "Partially Paid": "bg-accent/20 text-accent",
  Overdue: "bg-destructive/10 text-destructive",
  Cancelled: "bg-muted text-muted-foreground line-through",
};

export function InvoiceList({ invoices, onRecordPayment }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No invoices found. Create your first invoice to get started.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium text-muted-foreground">Invoice No</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-right p-3 font-medium text-muted-foreground">GST</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const gstAmount = inv.isSameState ? inv.cgst + inv.sgst : inv.igst;
                return (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="p-3 font-medium">{inv.clientName}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(inv.invoiceDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-3 text-right">₹{inv.subtotal.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right text-muted-foreground">₹{gstAmount.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-semibold">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-center">
                      <Badge className={`text-[10px] ${statusColors[inv.status]}`}>{inv.status}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.info("Invoice preview coming soon")}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.info("PDF download coming soon")}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-[#25D366]"
                          onClick={() => toast.success(`Invoice sent to ${inv.clientName} via WhatsApp`)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                        {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-primary"
                            onClick={() => onRecordPayment(inv)}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{inv.clientName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                </div>
                <Badge className={`text-[10px] ${statusColors[inv.status]}`}>{inv.status}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</span>
                <span>Due: {new Date(inv.dueDate).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold">₹{inv.grandTotal.toLocaleString("en-IN")}</span>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-[#25D366]"
                    onClick={() => toast.success(`Invoice sent to ${inv.clientName} via WhatsApp`)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => onRecordPayment(inv)}
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-1" />
                      Record Payment
                    </Button>
                  )}
                </div>
              </div>
              {inv.amountPaid > 0 && inv.amountDue > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Paid: ₹{inv.amountPaid.toLocaleString("en-IN")} • Due: ₹{inv.amountDue.toLocaleString("en-IN")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
