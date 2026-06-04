import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { defaultTemplates, fetchMessageTemplatesFromSupabase, MessageTemplate, TemplateCategory } from "@/data/mockWhatsapp";
import { fetchClientsFromSupabase, type Client } from "@/data/Clients";
import { Send, ChevronRight, ChevronLeft, Search, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useFinancialYear } from "@/context/financialYear";

type Step = 1 | 2 | 3 | 4 | 5;

const recipientFilters = [
  { id: "all", label: "All Clients" },
  { id: "gst", label: "Clients with GST" },
  { id: "itr", label: "Clients with ITR due" },
  { id: "fees", label: "Clients with pending fees" },
  { id: "custom", label: "Custom selection" },
];

export function BulkSender() {
  const { selectedFY } = useFinancialYear();
  const [step, setStep] = useState<Step>(1);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const template = templates.find((t) => t.id === selectedTemplate);

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const data = await fetchMessageTemplatesFromSupabase();
        setTemplates(data);
      } catch (err: any) {
        setTemplatesError(err.message ?? "Unable to load templates");
        setTemplates(defaultTemplates);
      } finally {
        setTemplatesLoading(false);
      }
    };

    const loadClients = async () => {
      setClientsLoading(true);
      setClientsError(null);
      try {
        const data = await fetchClientsFromSupabase();
        setClients(data);
      } catch (err: any) {
        setClientsError(err.message ?? "Unable to load clients");
        setClients([]);
      } finally {
        setClientsLoading(false);
      }
    };

    loadTemplates();
    loadClients();
  }, []);

  const getFilteredClients = () => {
    switch (recipientFilter) {
      case "gst": return clients.filter((c) => c.gstin);
      case "fees": return clients.filter((c) => c.pendingFees > 0);
      case "itr": return clients.filter((c) => c.servicesSubscribed.includes("ITR Filing"));
      default: return clients;
    }
  };

  const filteredClients = getFilteredClients();
  const searchedClients = filteredClients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  const toggleClient = (id: string) => {
    setSelectedClients((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const visibleIds = searchedClients.map((c) => c.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedClients.includes(id));
    setSelectedClients((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds])),
    );
  };

  const renderPreview = (client: Client) => {
    if (!template) return "";
    const replacements: Record<string, string> = {
      client_name: client.name,
      firm_name: "Sharma & Associates",
      ca_name: "CA Rajesh Sharma",
      ca_phone: "9876543210",
      due_date: new Date().toLocaleDateString("en-IN"),
      filing_type: client.servicesSubscribed[0] ?? "Compliance filing",
      doc_name: "N/A",
      document_list: "N/A",
      upload_link: "N/A",
      amount: client.pendingFees ? client.pendingFees.toLocaleString("en-IN") : "0",
      financial_year: selectedFY.replace("FY ", ""),
      invoice_number: "N/A",
      service_description: client.servicesSubscribed.join(", ") || "Professional services",
      upi_id: "N/A",
      ack_number: "N/A",
      filing_date: new Date().toLocaleDateString("en-IN"),
      payment_date: new Date().toLocaleDateString("en-IN"),
      receipt_number: "N/A",
      instalment_number: "N/A",
      percentage: "N/A",
      year: String(new Date().getFullYear()),
    };

    return template.body
      .replace(/\{\{(\w+)\}\}/g, (_match, key) => replacements[key] ?? "N/A");
  };

  const handleSend = async () => {
    if (!template) return;

    const recipients = selectedClients
      .map((id) => clients.find((client) => client.id === id))
      .filter(Boolean) as Client[];

    setSending(true);
    try {
      const { error } = await supabase.from("whatsapp_sent_messages").insert(
        recipients.map((client) => ({
          client_id: client.id,
          client_name: client.name,
          phone: client.phone,
          template_name: template.name,
          message: renderPreview(client),
          status: scheduleType === "now" ? "sent" : "sent",
          sent_at: scheduleType === "later" && scheduleDate
            ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
            : new Date().toISOString(),
        })),
      );

      if (error) throw error;

      toast.success(`${scheduleType === "now" ? "Sent" : "Scheduled"} ${selectedClients.length} messages!`, {
        description: scheduleType === "later" ? `Scheduled for ${scheduleDate} at ${scheduleTime}` : undefined,
      });
      setStep(1);
      setSelectedTemplate("");
      setSelectedClients([]);
      setRecipientFilter("all");
      setScheduleType("now");
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to record WhatsApp messages");
    } finally {
      setSending(false);
    }
  };

  const canNext = () => {
    if (step === 1) return !!selectedTemplate;
    if (step === 2) return selectedClients.length > 0;
    if (step === 3) return true;
    if (step === 4) return scheduleType === "now" || (!!scheduleDate && !!scheduleTime);
    return true;
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Step Indicator */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {["Template", "Recipients", "Preview", "Schedule", "Confirm"].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
              step > i + 1 ? "bg-[#25D366] text-white" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {step > i + 1 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${step === i + 1 ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            {i < 4 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground max-sm:hidden" aria-hidden />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Template */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Select Message Template</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {templatesLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading templates...
              </div>
            ) : templatesError ? (
              <div className="text-center text-destructive py-12">
                <AlertCircle className="mx-auto mb-2 h-6 w-6" />
                {templatesError}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center break-words px-1 py-12 text-muted-foreground">No templates available. Please create one in the Templates tab.</div>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTemplate === t.id ? "border-[#25D366] bg-[#25D366]/5" : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Recipients */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Select Recipients</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={recipientFilter} onValueChange={(v) => { setRecipientFilter(v); setSelectedClients([]); }}>
              <SelectTrigger><SelectValue placeholder="Filter clients..." /></SelectTrigger>
              <SelectContent>
                {recipientFilters.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-9" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
            </div>

            {clientsLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading clients...
              </div>
            ) : clientsError ? (
              <div className="text-center text-destructive py-12">
                <AlertCircle className="mx-auto mb-2 h-6 w-6" />
                {clientsError}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Checkbox checked={searchedClients.length > 0 && searchedClients.every((c) => selectedClients.includes(c.id))} onCheckedChange={toggleAll} />
                  <span className="text-sm font-medium">Select All ({searchedClients.length})</span>
                  <Badge className="ml-auto">{selectedClients.length} selected</Badge>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {searchedClients.length > 0 ? searchedClients.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 py-2 px-1 hover:bg-muted/50 rounded">
                      <Checkbox checked={selectedClients.includes(c.id)} onCheckedChange={() => toggleClient(c.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{c.type}</Badge>
                    </div>
                  )) : (
                    <div className="text-center py-12 text-muted-foreground">No clients match the filter/search.</div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Preview Messages</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Showing preview for first 3 selected clients:</p>
            {selectedClients.slice(0, 3).map((id) => {
              const client = clients.find((c) => c.id === id);
              if (!client) return null;
              return (
                <div key={id} className="rounded-xl bg-[#dcf8c6] p-3 text-sm border border-[#25D366]/20">
                  <p className="font-medium text-xs text-[#25D366] mb-1">To: {client.name} ({client.phone})</p>
                  <p className="whitespace-pre-wrap text-xs">{renderPreview(client)}</p>
                </div>
              );
            })}
            <p className="text-sm font-medium text-center pt-2">
              Message looks correct? Will be sent to all <span className="text-[#25D366] font-bold">{selectedClients.length}</span> clients.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Schedule */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Schedule or Send Now</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setScheduleType("now")}
                className={`p-4 rounded-lg border cursor-pointer text-center transition-colors ${
                  scheduleType === "now" ? "border-[#25D366] bg-[#25D366]/5" : "border-border"
                }`}
              >
                <Send className="h-6 w-6 mx-auto mb-2 text-[#25D366]" />
                <p className="text-sm font-medium">Send Now</p>
              </div>
              <div
                onClick={() => setScheduleType("later")}
                className={`p-4 rounded-lg border cursor-pointer text-center transition-colors ${
                  scheduleType === "later" ? "border-[#25D366] bg-[#25D366]/5" : "border-border"
                }`}
              >
                <Clock className="h-6 w-6 mx-auto mb-2 text-accent" />
                <p className="text-sm font-medium">Schedule</p>
              </div>
            </div>
            {scheduleType === "later" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Confirm */}
      {step === 5 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Confirm & Send</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Template:</span><span className="font-medium">{template?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Recipients:</span><span className="font-medium">{selectedClients.length} clients</span></div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery:</span>
                <span className="font-medium">{scheduleType === "now" ? "Immediately" : `${scheduleDate} at ${scheduleTime}`}</span>
              </div>
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-2 h-11">
              <Send className="h-4 w-4" />
              {sending ? "Recording..." : scheduleType === "now" ? `Send to ${selectedClients.length} Clients` : `Schedule for ${selectedClients.length} Clients`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < 5 && (
          <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canNext()} className="bg-primary shrink-0">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
