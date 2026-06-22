import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fetchReceivedMessagesFromSupabase, markReceivedMessageRead, ReceivedMessage } from "@/data/WhatsappApi";
import { Search, CheckCheck, Circle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function ReceivedMessages() {
  const [messages, setMessages] = useState<ReceivedMessage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchReceivedMessagesFromSupabase();
        setMessages(data);
      } catch (err: any) {
        setError(err.message ?? "Unable to load messages");
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, []);

  const filtered = messages.filter((m) => m.clientName.toLowerCase().includes(search.toLowerCase()) || m.message.toLowerCase().includes(search.toLowerCase()));

  const unreadCount = messages.filter((m) => !m.isRead).length;

  const markAsRead = async (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
    try {
      await markReceivedMessageRead(id);
    } catch {
      toast.error("Unable to update message status");
    }
  };

  const markAllRead = async () => {
    const unreadIds = messages.filter((m) => !m.isRead).map((m) => m.id);
    setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
    try {
      await Promise.all(unreadIds.map((id) => markReceivedMessageRead(id)));
      toast.success("All messages marked as read");
    } catch {
      toast.error("Unable to update all message statuses");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search messages..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2 shrink-0">
            <CheckCheck className="h-4 w-4" /> Mark all as read ({unreadCount})
          </Button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading messages...
        </div>
      ) : error ? (
        <div className="text-center text-destructive py-12">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          {error}
        </div>
      ) : (
        <>

      <div className="space-y-2">
        {filtered.map((msg) => (
          <Card key={msg.id} className={`transition-colors ${!msg.isRead ? "border-l-2 border-l-[#25D366] bg-[#25D366]/5" : ""}`}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                {!msg.isRead && <Circle className="h-2.5 w-2.5 fill-[#25D366] text-[#25D366] mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{msg.clientName}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(msg.receivedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{" "}
                      {new Date(msg.receivedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{msg.phone}</p>
                  <p className="text-sm">{msg.message}</p>
                  {!msg.isRead && (
                    <Button variant="ghost" size="sm" className="mt-2 h-6 text-xs text-[#25D366]" onClick={() => markAsRead(msg.id)}>
                      Mark as read
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No received messages.</div>
      )}
        </>
      )}
    </div>
  );
}
