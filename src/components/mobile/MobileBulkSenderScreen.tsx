import { useState, useEffect } from "react";
import { Search, Send, Loader2, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import {
  compileTemplateForClient,
  defaultTemplates,
  fetchMessageTemplatesFromSupabase,
  MessageTemplate,
  sendBulkWhatsAppMessages,
} from "@/data/WhatsappApi";
import { fetchClientsFromSupabase, type Client } from "@/data/Clients";
import { fetchFirmProfileFromSupabase, type FirmProfile } from "@/data/Settings";
import { useFinancialYear } from "@/context/financialYear";

const recipientFilters = [
  { id: "all", label: "All" },
  { id: "gst", label: "GST" },
  { id: "itr", label: "ITR due" },
  { id: "fees", label: "Fees pending" },
];

export function MobileBulkSenderScreen() {
  const { selectedFY } = useFinancialYear();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [firmProfile, setFirmProfile] = useState<FirmProfile | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const template = templates.find((t) => t.id === selectedTemplate);

  useEffect(() => {
    fetchMessageTemplatesFromSupabase()
      .then(setTemplates)
      .catch(() => setTemplates(defaultTemplates))
      .finally(() => setTemplatesLoading(false));
    fetchClientsFromSupabase()
      .then(setClients)
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
    fetchFirmProfileFromSupabase()
      .then(setFirmProfile)
      .catch(() => setFirmProfile(null));
  }, []);

  const filteredClients = (() => {
    switch (recipientFilter) {
      case "gst": return clients.filter((c) => c.gstin);
      case "fees": return clients.filter((c) => c.pendingFees > 0);
      case "itr": return clients.filter((c) => c.servicesSubscribed.includes("ITR Filing"));
      default: return clients;
    }
  })();
  const searchedClients = filteredClients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  const toggleClient = (id: string) => {
    setSelectedClients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const previewClient = clients.find((c) => c.id === selectedClients[0]);
  const previewText = template && previewClient
    ? compileTemplateForClient(template, previewClient, selectedFY, firmProfile ?? undefined).text
    : "";

  const handleSend = async () => {
    if (!template || selectedClients.length === 0) return;
    const recipients = selectedClients.map((id) => clients.find((c) => c.id === id)).filter(Boolean) as Client[];

    setSending(true);
    try {
      const compiledTexts: Record<string, string> = {};
      const parametersByClientId: Record<string, string[]> = {};
      recipients.forEach((client) => {
        const compiled = compileTemplateForClient(template, client, selectedFY, firmProfile ?? undefined);
        compiledTexts[client.id] = compiled.text;
        parametersByClientId[client.id] = compiled.parameters;
      });

      await sendBulkWhatsAppMessages(recipients, template, compiledTexts, parametersByClientId);

      toast.success(`${scheduleType === "now" ? "Sent" : "Scheduled"} ${selectedClients.length} messages!`, {
        description: scheduleType === "later" ? `Scheduled for ${scheduleDate} at ${scheduleTime}` : undefined,
      });

      setSelectedTemplate("");
      setSelectedClients([]);
      setRecipientFilter("all");
      setScheduleType("now");
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to send WhatsApp messages");
    } finally {
      setSending(false);
    }
  };

  const canSend = !!template && selectedClients.length > 0 && (scheduleType === "now" || (!!scheduleDate && !!scheduleTime)) && !sending;

  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-28 min-h-[calc(100vh-8rem)]">
      <div className="font-mobile-heading font-normal text-2xl mb-4">Bulk WhatsApp</div>

      <div className="text-xs font-bold text-mobile-neutral-600 mb-2">1. Template</div>
      {templatesLoading ? (
        <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600 mb-4">Loading templates...</div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {templates.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`text-left rounded-mobile-md p-3 shadow-mobile-sm ${
                selectedTemplate === t.id ? "bg-mobile-accent text-white" : "bg-mobile-neutral-100 text-mobile-text"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-bold text-sm">{t.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedTemplate === t.id ? "bg-white/20" : "bg-mobile-neutral-200"}`}>
                  {t.category}
                </span>
              </div>
              <p className={`text-xs line-clamp-2 ${selectedTemplate === t.id ? "text-white/85" : "text-mobile-neutral-600"}`}>{t.body}</p>
            </button>
          ))}
        </div>
      )}

      <div className="text-xs font-bold text-mobile-neutral-600 mb-2">2. Recipients</div>
      <div className="flex gap-2 overflow-x-auto mb-2.5 pb-1 -mx-4 px-4">
        {recipientFilters.map((f) => (
          <button
            type="button"
            key={f.id}
            onClick={() => { setRecipientFilter(f.id); setSelectedClients([]); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
              recipientFilter === f.id ? "bg-mobile-accent text-white" : "bg-mobile-surface text-mobile-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="relative mb-2.5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mobile-neutral-500" />
        <input
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          placeholder="Search clients"
          className="w-full box-border border border-mobile-neutral-300 rounded-full bg-mobile-neutral-100 py-2.5 pl-10 pr-4 text-sm text-mobile-text outline-none"
        />
      </div>
      {clientsLoading ? (
        <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600 mb-4">Loading clients...</div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto mb-4">
          {searchedClients.length > 0 ? (
            searchedClients.map((c) => {
              const checked = selectedClients.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleClient(c.id)}
                  className="flex items-center gap-3 bg-mobile-neutral-100 rounded-mobile-sm p-2.5"
                >
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      checked ? "bg-mobile-accent text-white" : "bg-mobile-surface border border-mobile-neutral-300"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-bold truncate">{c.name}</div>
                    <div className="text-xs text-mobile-neutral-600">{c.phone}</div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600">No clients match.</div>
          )}
        </div>
      )}
      {selectedClients.length > 0 && (
        <div className="text-xs font-bold text-mobile-accent-700 mb-4">{selectedClients.length} selected</div>
      )}

      {previewText && (
        <>
          <div className="text-xs font-bold text-mobile-neutral-600 mb-2">3. Preview</div>
          <div className="rounded-mobile-md bg-[#dcf8c6] p-3 text-sm mb-4">
            <p className="font-bold text-xs text-[#128C4A] mb-1">To: {previewClient?.name}</p>
            <p className="whitespace-pre-wrap text-xs">{previewText}</p>
            {selectedClients.length > 1 && (
              <p className="text-[11px] text-mobile-neutral-600 mt-1.5">+ {selectedClients.length - 1} more, personalized the same way</p>
            )}
          </div>
        </>
      )}

      <div className="text-xs font-bold text-mobile-neutral-600 mb-2">4. Delivery</div>
      <div className="flex gap-2 mb-2.5">
        <button
          type="button"
          onClick={() => setScheduleType("now")}
          className={`flex-1 rounded-mobile-md py-2.5 text-xs font-bold flex flex-col items-center gap-1 ${
            scheduleType === "now" ? "bg-mobile-accent text-white" : "bg-mobile-neutral-100 text-mobile-text"
          }`}
        >
          <Send className="h-4 w-4" /> Send Now
        </button>
        <button
          type="button"
          onClick={() => setScheduleType("later")}
          className={`flex-1 rounded-mobile-md py-2.5 text-xs font-bold flex flex-col items-center gap-1 ${
            scheduleType === "later" ? "bg-mobile-accent text-white" : "bg-mobile-neutral-100 text-mobile-text"
          }`}
        >
          <Clock className="h-4 w-4" /> Schedule
        </button>
      </div>
      {scheduleType === "later" && (
        <div className="flex gap-2 mb-4">
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="flex-1 border border-mobile-neutral-300 rounded-mobile-sm bg-mobile-surface py-2 px-2.5 text-sm outline-none"
          />
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="flex-1 border border-mobile-neutral-300 rounded-mobile-sm bg-mobile-surface py-2 px-2.5 text-sm outline-none"
          />
        </div>
      )}

      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 md:hidden">
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="w-full rounded-full py-3.5 bg-mobile-accent text-white text-sm font-bold shadow-mobile-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending
            ? "Sending..."
            : scheduleType === "now"
              ? `Send to ${selectedClients.length || 0} Client${selectedClients.length === 1 ? "" : "s"}`
              : `Schedule for ${selectedClients.length || 0} Client${selectedClients.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
