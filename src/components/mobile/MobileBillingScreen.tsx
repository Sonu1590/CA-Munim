import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Invoice } from "@/data/Billing";
import { sendQuickReminder } from "@/data/WhatsappApi";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/sonner";

interface MobileBillingScreenProps {
  invoices: Invoice[];
  onRecordPayment: (invoice: Invoice) => void;
  onCreateInvoice: () => void;
}

export function MobileBillingScreen({ invoices, onRecordPayment, onCreateInvoice }: MobileBillingScreenProps) {
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const handleSendReminder = async (inv: Invoice) => {
    setRemindingId(inv.id);
    try {
      const { data: client, error } = await supabase.from("clients").select("phone").eq("id", inv.clientId).single();
      if (error || !client) throw new Error("Could not look up this client's phone number.");
      await sendQuickReminder(
        { id: inv.clientId, name: inv.clientName, phone: client.phone, pendingFees: inv.amountDue },
        "Invoice Payment Due",
        inv.financialYear
      );
      toast.success(`Reminder sent to ${inv.clientName}`);
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to send reminder to ${inv.clientName}`);
    } finally {
      setRemindingId(null);
    }
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthInvoices = invoices.filter((inv) => {
    const d = new Date(inv.invoiceDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const totalReceivedThisMonth = thisMonthInvoices.reduce((s, i) => s + i.amountPaid, 0);

  // Same "billed, unpaid, not cancelled/draft" filter as FeesDashboard.tsx —
  // keep identical so mobile and desktop always agree on what's outstanding.
  const billedUnpaidInvoices = invoices.filter((i) => i.amountDue > 0 && i.status !== "Cancelled" && i.status !== "Draft");
  const totalOutstanding = billedUnpaidInvoices.reduce((s, i) => s + i.amountDue, 0);
  const unpaidInvoices = billedUnpaidInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-8 min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-3.5">
        <span className="font-mobile-heading font-normal text-2xl">Billing</span>
        <button
          onClick={onCreateInvoice}
          aria-label="Create invoice"
          className="w-10 h-10 rounded-full bg-mobile-accent text-white flex items-center justify-center shadow-mobile-sm"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="bg-mobile-accent rounded-mobile-lg p-5 text-white shadow-mobile-md mb-3 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="text-xs opacity-85">Outstanding fees</div>
        <div className="font-mobile-heading font-normal text-4xl my-0.5 mb-2.5">
          ₹{totalOutstanding.toLocaleString("en-IN")}
        </div>
        <div className="flex gap-4 text-xs">
          <span>
            Collected this month: <b>₹{totalReceivedThisMonth.toLocaleString("en-IN")}</b>
          </span>
          <span>{unpaidInvoices.length} unpaid invoices</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {unpaidInvoices.map((inv) => {
          const isOverdue = new Date(inv.dueDate) < now;
          return (
            <div key={inv.id} className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm">{inv.clientName}</div>
                  <div className="text-xs text-mobile-neutral-600">
                    {inv.invoiceNumber} · {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm">₹{inv.amountDue.toLocaleString("en-IN")}</div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isOverdue ? "bg-mobile-accent-200 text-mobile-accent-800" : "bg-mobile-neutral-200 text-mobile-neutral-700"
                    }`}
                  >
                    {isOverdue ? "Overdue" : inv.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-2.5">
                <button
                  disabled={remindingId === inv.id}
                  onClick={() => handleSendReminder(inv)}
                  className="flex-1 rounded-full py-2 bg-mobile-accent-2-200 text-mobile-accent-2-800 text-xs font-bold disabled:opacity-60 flex items-center justify-center"
                >
                  {remindingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send reminder"}
                </button>
                <button
                  onClick={() => onRecordPayment(inv)}
                  className="flex-1 rounded-full py-2 bg-mobile-accent text-white text-xs font-bold"
                >
                  Record payment
                </button>
              </div>
            </div>
          );
        })}
        {unpaidInvoices.length === 0 && (
          <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600">
            No outstanding invoices 🎉
          </div>
        )}
      </div>
    </div>
  );
}
