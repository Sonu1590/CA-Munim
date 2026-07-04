import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { compileTemplateForClient, fetchMessageTemplatesFromSupabase, fetchSentMessagesFromSupabase, sendBulkWhatsAppMessages, SentMessage } from "@/data/WhatsappApi";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { useFinancialYear } from "@/context/financialYear";
import { Search, RefreshCw, Check, CheckCheck, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<SentMessage["status"], { label: string; icon: React.ReactNode; className: string }> = {
  sent: { label: "Sent", icon: <Check className="h-3.5 w-3.5" />, className: "bg-muted text-muted-foreground" },
  delivered: { label: "Delivered", icon: <CheckCheck className="h-3.5 w-3.5" />, className: "bg-muted text-muted-foreground" },
  read: { label: "Read", icon: <CheckCheck className="h-3.5 w-3.5" />, className: "bg-blue-100 text-blue-600" },
  failed: { label: "Failed", icon: <span className="text-xs">✗</span>, className: "bg-destructive/10 text-destructive" },
};

export function DeliveryStatus() {
  const { selectedFY } = useFinancialYear();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSentMessagesFromSupabase();
      setMessages(data);
    } catch (err: any) {
      setError(err.message ?? "Unable to load sent messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const filtered = messages.filter((m) => m.clientName.toLowerCase().includes(search.toLowerCase()));

  const handleRetry = async (msg: SentMessage) => {
    setRetryingId(msg.id);
    try {
      const [allClients, allTemplates] = await Promise.all([
        fetchClientsFromSupabase(),
        fetchMessageTemplatesFromSupabase(),
      ]);

      const client = allClients.find((c) => c.id === msg.clientId);
      if (!client) throw new Error("This client no longer exists.");

      const template = allTemplates.find((t) => t.name === msg.templateName);
      if (!template) throw new Error("This template no longer exists.");

      const { text, parameters } = compileTemplateForClient(template, client, selectedFY);

      await sendBulkWhatsAppMessages(
        [{ id: client.id, name: client.name, phone: client.phone }],
        template,
        { [client.id]: text },
        { [client.id]: parameters }
      );

      toast.success(`Message resent to ${msg.clientName}`);
      await loadMessages();
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to retry message to ${msg.clientName}`);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by client name..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading status...
        </div>
      ) : error ? (
        <div className="text-center text-destructive py-12">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {(["sent", "delivered", "read", "failed"] as const).map((s) => {
              const count = messages.filter((m) => m.status === s).length;
              const cfg = statusConfig[s];
              return (
                <Card key={s} className="text-center p-3">
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s}</p>
                </Card>
              );
            })}
          </div>

          {/* Messages Table (mobile cards) */}
      <div className="space-y-2">
        {filtered.map((msg) => {
          const cfg = statusConfig[msg.status];
          return (
            <Card key={msg.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{msg.clientName}</p>
                    <p className="text-xs text-muted-foreground">{msg.phone}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{msg.templateName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={`gap-1 text-[10px] ${cfg.className}`}>
                      {cfg.icon} {cfg.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(msg.sentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{" "}
                      {new Date(msg.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                {msg.status === "failed" && (
                  <div className="mt-2 flex items-center justify-between bg-destructive/5 rounded-lg px-2 py-1.5">
                    <span className="text-xs text-destructive">{msg.failReason}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs gap-1"
                      disabled={retryingId === msg.id}
                      onClick={() => handleRetry(msg)}
                    >
                      {retryingId === msg.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Retry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No messages found.</div>
          )}
        </>
      )}
    </div>
  );
}
