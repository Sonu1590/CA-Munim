import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Client, ClientFormData, ClientMutationResult } from "@/hooks/useClients";
import { Task } from "@/hooks/useTasks";
import { Invoice } from "@/data/Billing";
import { AddClientModal } from "@/components/clients/AddClientModal";

interface MobileClientProfileScreenProps {
  client: Client;
  clientTasks: Task[];
  clientInvoices: Invoice[];
  onUpdateClient: (id: string, formData: Partial<ClientFormData>) => Promise<ClientMutationResult>;
  formatDate: (date?: string) => string;
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}`;
}

type Tab = "overview" | "tasks" | "billing";

export function MobileClientProfileScreen({
  client,
  clientTasks,
  clientInvoices,
  onUpdateClient,
  formatDate,
}: MobileClientProfileScreenProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-8 min-h-[calc(100vh-8rem)]">
      <button
        type="button"
        onClick={() => navigate("/clients")}
        className="flex items-center gap-1 text-sm font-bold text-mobile-neutral-600 mb-3"
      >
        <ArrowLeft className="h-4 w-4" /> Clients
      </button>

      <div className="bg-mobile-neutral-100 rounded-mobile-lg p-4 shadow-mobile-sm mb-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-12 h-12 rounded-full bg-mobile-accent-2-200 text-mobile-accent-2-800 flex items-center justify-center font-bold">
            {initialsFor(client.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mobile-heading font-normal text-xl truncate">{client.name}</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-mobile-accent text-white">{client.type}</span>
              {client.pan && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-mobile-neutral-200 text-mobile-neutral-700 font-mono">
                  {client.pan}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label="Edit client"
            className="shrink-0 w-9 h-9 rounded-full bg-mobile-surface text-mobile-neutral-700 flex items-center justify-center"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 mt-3.5">
          <button
            type="button"
            onClick={() => (window.location.href = `tel:${client.phone}`)}
            disabled={!client.phone}
            className="flex-1 rounded-full py-2 bg-mobile-surface text-mobile-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </button>
          <a
            href={client.phone ? waLink(client.phone) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!client.phone}
            className={`flex-1 rounded-full py-2 bg-mobile-accent-2-200 text-mobile-accent-2-800 text-xs font-bold flex items-center justify-center gap-1.5 ${
              !client.phone ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(["overview", "tasks", "billing"] as Tab[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-xs font-bold capitalize ${
              tab === t ? "bg-mobile-accent text-white" : "bg-mobile-surface text-mobile-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-2.5">
          <div className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm">
            <div className="text-xs font-bold text-mobile-neutral-600 mb-2">Profile</div>
            <div className="text-sm space-y-1">
              <p><span className="text-mobile-neutral-500">DOB/Incorp:</span> {formatDate(client.date_of_birth)}</p>
              <p><span className="text-mobile-neutral-500">City:</span> {client.city || "-"}</p>
              <p><span className="text-mobile-neutral-500">State:</span> {client.state || "-"}</p>
              <p><span className="text-mobile-neutral-500">Email:</span> {client.email || "-"}</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1 bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm">
              <div className="text-xs text-mobile-neutral-600">Tasks</div>
              <div className="font-mobile-heading font-normal text-2xl">{clientTasks.length}</div>
            </div>
            <div className="flex-1 bg-mobile-accent rounded-mobile-md p-3.5 shadow-mobile-sm text-white">
              <div className="text-xs opacity-85">Pending Fees</div>
              <div className="font-mobile-heading font-normal text-2xl">₹{client.pendingFees.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="flex flex-col gap-2.5">
          {clientTasks.length ? (
            clientTasks.map((task) => (
              <div key={task.id} className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{task.customName || task.taskType}</div>
                  <div className="text-xs text-mobile-neutral-600">{task.financialYear} · Due {formatDate(task.dueDate)}</div>
                </div>
                <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-mobile-neutral-200 text-mobile-neutral-700 capitalize">
                  {task.status.replace("_", " ")}
                </span>
              </div>
            ))
          ) : (
            <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600">
              No tasks for this client yet.
            </div>
          )}
        </div>
      )}

      {tab === "billing" && (
        <div className="flex flex-col gap-2.5">
          {clientInvoices.length ? (
            clientInvoices.map((invoice) => (
              <div key={invoice.id} className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{invoice.invoiceNumber}</div>
                  <div className="text-xs text-mobile-neutral-600">{invoice.financialYear} · {formatDate(invoice.invoiceDate)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm">₹{invoice.total.toLocaleString("en-IN")}</div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-mobile-neutral-200 text-mobile-neutral-700 capitalize">
                    {invoice.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600">
              No invoices for this client yet.
            </div>
          )}
        </div>
      )}

      <AddClientModal
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSave={async (formData) => {
          const result = await onUpdateClient(client.id, formData);
          if (result.success) {
            toast.success("Client updated");
            setEditOpen(false);
          } else {
            toast.error(result.error ?? "Could not save client. Please check the details and try again.");
          }
          return result;
        }}
      />
    </div>
  );
}
