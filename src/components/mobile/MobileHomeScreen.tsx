import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, MessageCircle, CheckCircle2, UserPlus, ClipboardList, Receipt, Send } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { CreateInvoiceModal } from "@/components/billing/CreateInvoiceModal";
import { BulkSender } from "@/components/whatsapp/BulkSender";

import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import { useFinancialYear } from "@/context/financialYear";
import { supabase } from "@/lib/supabase";
import { sendQuickReminder } from "@/data/WhatsappApi";
import type { DashboardMetrics, ComplianceAlert, DigestItem } from "@/hooks/useDashboard";

interface MobileHomeScreenProps {
  metrics: DashboardMetrics;
  complianceAlerts: ComplianceAlert[];
  digest: DigestItem[];
  caName: string;
  refetch: () => void;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// The live message_templates table has filing-specific templates (e.g.
// "GST Filing Reminder", "ITR Filing Reminder") but no single generic
// "any filing type" reminder — so pick the best real match by task type
// rather than pointing at one fixed name that may not exist. For task
// types with no matching template yet (TDS/ROC/Other), sendQuickReminder
// throws its own clear "no template found" error, surfaced via toast —
// honest about the gap rather than silently using an unrelated template.
function templateSearchTermFor(taskType: string): string {
  if (/gst/i.test(taskType)) return "GST Filing Reminder";
  if (/itr|income\s*tax/i.test(taskType)) return "ITR Filing Reminder";
  return "Filing Reminder";
}

function formatDayMonth(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
  };
}

export function MobileHomeScreen({ metrics, complianceAlerts, digest, caName, refetch }: MobileHomeScreenProps) {
  const navigate = useNavigate();
  const { selectedFY } = useFinancialYear();
  const { addClient } = useClients();
  const { addTask, updateTaskStatus } = useTasks();

  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [filingId, setFilingId] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  const displayName = caName ? `CA ${caName}` : "CA";
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const handleNudge = async (item: DigestItem) => {
    setNudgingId(item.id);
    try {
      const { data: client, error } = await supabase.from("clients").select("phone").eq("id", item.clientId).single();
      if (error || !client?.phone) throw new Error("No phone number on file for this client.");
      await sendQuickReminder({ id: item.clientId, name: item.clientName, phone: client.phone }, templateSearchTermFor(item.taskType), selectedFY);
      toast.success(`Reminder sent to ${item.clientName}`);
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to send reminder to ${item.clientName}`);
    } finally {
      setNudgingId(null);
    }
  };

  const handleMarkFiled = async (item: DigestItem) => {
    setFilingId(item.id);
    try {
      const success = await updateTaskStatus(item.id, "completed");
      if (success) {
        toast.success(`${item.taskType} marked as filed`);
        refetch();
      }
    } finally {
      setFilingId(null);
    }
  };

  const quickActions = [
    { label: "Add Client", icon: UserPlus, onClick: () => setClientOpen(true) },
    { label: "Add Task", icon: ClipboardList, onClick: () => setTaskOpen(true) },
    { label: "New Invoice", icon: Receipt, onClick: () => setInvoiceOpen(true) },
    { label: "Bulk WhatsApp", icon: Send, onClick: () => setWhatsappOpen(true) },
  ];

  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-8 min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-mobile-heading font-normal text-2xl text-mobile-accent">CA Munim</span>
        <button
          className="w-10 h-10 rounded-full bg-mobile-neutral-100 flex items-center justify-center shadow-mobile-sm"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5 text-mobile-neutral-700" />
        </button>
      </div>
      <p className="text-sm text-mobile-neutral-700 mb-4">
        {greeting()}, {displayName} · {todayLabel}
      </p>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm">
          <div className="text-2xl font-bold">{metrics.totalClients}</div>
          <div className="text-xs text-mobile-neutral-600">Active clients</div>
        </div>
        <div className="bg-mobile-accent-100 rounded-mobile-md p-3.5 shadow-mobile-sm">
          <div className="text-2xl font-bold text-mobile-accent-700">{metrics.overdueTasks}</div>
          <div className="text-xs text-mobile-accent-700">Overdue filings</div>
        </div>
        <div className="bg-mobile-accent-2-200 rounded-mobile-md p-3.5 shadow-mobile-sm">
          <div className="text-2xl font-bold text-mobile-accent-2-800">{metrics.dueThisWeek}</div>
          <div className="text-xs text-mobile-accent-2-800">Due this week</div>
        </div>
        <div className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm">
          <div className="text-xl font-bold pt-0.5">{formatCurrency(metrics.pendingFees)}</div>
          <div className="text-xs text-mobile-neutral-600">Fees to collect</div>
        </div>
      </div>

      {/* Needs your attention */}
      <h2 className="font-mobile-heading font-normal text-lg mb-2.5">Needs your attention</h2>
      <div className="flex flex-col gap-2.5 mb-5">
        {digest.map((item) => (
          <div key={item.id} className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-sm">{item.taskType}</div>
                <div className="text-xs text-mobile-neutral-600">{item.clientName}</div>
              </div>
              <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-mobile-accent-200 text-mobile-accent-800">
                {item.daysOverdue > 0 ? `${item.daysOverdue}d overdue` : "Due today"}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                disabled={nudgingId === item.id}
                onClick={() => handleNudge(item)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 bg-mobile-accent-2-200 text-mobile-accent-2-800 text-xs font-bold disabled:opacity-60"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Nudge on WhatsApp
              </button>
              <button
                disabled={filingId === item.id}
                onClick={() => handleMarkFiled(item)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 bg-mobile-accent text-white text-xs font-bold disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark filed
              </button>
            </div>
          </div>
        ))}
        {digest.length === 0 && (
          <div className="bg-mobile-accent-2-100 rounded-mobile-md p-4.5 text-center text-sm text-mobile-accent-2-800">
            All caught up — nothing overdue or due today 🎉
          </div>
        )}
      </div>

      {/* Compliance calendar */}
      <h2 className="font-mobile-heading font-normal text-lg mb-2.5">Compliance calendar</h2>
      <div className="bg-mobile-neutral-100 rounded-mobile-md shadow-mobile-sm overflow-hidden mb-5">
        {complianceAlerts.slice(0, 5).map((alert) => {
          const { day, month } = formatDayMonth(alert.dueDate);
          return (
            <div key={alert.id} className="flex items-center gap-3 px-4 py-3 border-b border-mobile-divider last:border-b-0">
              <div className="shrink-0 w-11 h-11 rounded-full bg-mobile-accent-100 text-mobile-accent-700 flex flex-col items-center justify-center font-bold leading-none">
                <span className="text-sm">{day}</span>
                <span className="text-[9px] uppercase">{month}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{alert.filingType}</div>
                <div className="text-xs text-mobile-neutral-600">
                  {alert.clientsAffected} client{alert.clientsAffected === 1 ? "" : "s"} ·{" "}
                  {alert.daysUntilDue < 0 ? `${Math.abs(alert.daysUntilDue)}d overdue` : `in ${alert.daysUntilDue}d`}
                </div>
              </div>
              <button onClick={() => navigate("/tasks")} className="text-mobile-accent-700 text-xs font-bold px-1.5">
                View
              </button>
            </div>
          );
        })}
        {complianceAlerts.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-mobile-neutral-600">No upcoming deadlines in the next 30 days.</div>
        )}
      </div>

      {/* Quick actions */}
      <h2 className="font-mobile-heading font-normal text-lg mb-2.5">Quick actions</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {quickActions.map((qa) => (
          <button
            key={qa.label}
            onClick={qa.onClick}
            className="flex items-center gap-2.5 rounded-mobile-md px-3.5 py-3 bg-mobile-surface text-sm font-semibold text-left"
          >
            <span className="shrink-0 w-8.5 h-8.5 rounded-full bg-mobile-accent-100 text-mobile-accent-700 flex items-center justify-center">
              <qa.icon className="h-4 w-4" />
            </span>
            {qa.label}
          </button>
        ))}
      </div>

      {/* Reuse the exact same modal/action wiring as the desktop QuickActions component */}
      <AddClientModal
        open={clientOpen}
        onOpenChange={setClientOpen}
        onSave={async (formData) => {
          const result = await addClient(formData);
          if (result.success) {
            toast.success("Client created successfully");
            setClientOpen(false);
          } else {
            toast.error(result.error ?? "Failed to create client");
          }
          return result;
        }}
      />

      <AddTaskModal
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onSave={async (taskData) => {
          const success = await addTask(taskData);
          if (success) {
            toast.success("Task created successfully");
            setTaskOpen(false);
          } else {
            toast.error("Failed to create task");
          }
          return success;
        }}
      />

      <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />

      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-heading">Bulk WhatsApp Reminder</DialogTitle>
          </DialogHeader>
          <div className="min-w-0 p-4">
            <BulkSender />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
