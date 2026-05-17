import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { documentRequestTypes } from "@/data/Documents";
import { supabase } from "@/lib/supabase";
import { MessageCircle, Link2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string;
}

export function DocumentRequestModal({ open, onOpenChange, preselectedClientId }: Props) {
  const [clientId, setClientId] = useState(preselectedClientId || "");
  const [docType, setDocType] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestToken, setRequestToken] = useState("");

  useEffect(() => {
    if (open) {
      const loadClients = async () => {
        setLoading(true);
        try {
          const data = await fetchClientsFromSupabase();
          setClients(data);
        } catch (err: any) {
          toast.error("Failed to load clients");
        } finally {
          setLoading(false);
        }
      };
      loadClients();
    }
  }, [open]);

  const isCustom = docType === "Custom";
  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (!clientId || !docType || !dueDate) {
      setRequestToken("");
      return;
    }

    const tokenArray = new Uint8Array(16);
    crypto.getRandomValues(tokenArray);
    setRequestToken(Array.from(tokenArray).map((b) => b.toString(16).padStart(2, "0")).join(""));
  }, [clientId, docType, dueDate]);

  const uploadLink = requestToken ? `${window.location.origin}/upload/${requestToken}` : "";

  const handleSend = async () => {
    if (!clientId || !docType || !dueDate) {
      toast.error("Please fill all required fields");
      return;
    }
    if (isCustom && !customLabel.trim()) {
      toast.error("Please enter the custom document label");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: staffRow } = await supabase
        .from("staff")
        .select("firm_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!staffRow?.firm_id) throw new Error("Firm not found");

      const token = requestToken || (() => {
        const tokenArray = new Uint8Array(16);
        crypto.getRandomValues(tokenArray);
        return Array.from(tokenArray).map((b) => b.toString(16).padStart(2, "0")).join("");
      })();

      const { error: insertErr } = await supabase
        .from("document_requests")
        .insert({
          firm_id: staffRow.firm_id,
          client_id: clientId,
          document_type: docType,
          custom_label: isCustom ? customLabel.trim() : null,
          due_date: dueDate,
          upload_token: token,
          status: "pending",
        });

      if (insertErr) throw insertErr;

      const link = `${window.location.origin}/upload/${token}`;
      await navigator.clipboard.writeText(link).catch(() => {});

      toast.success("Document request created!", {
        description: `Upload link copied to clipboard. Send it to ${client?.name ?? "client"} via WhatsApp.`,
      });

      onOpenChange(false);
      setClientId("");
      setDocType("");
      setCustomLabel("");
      setDueDate("");
      setRequestToken("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create document request");
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (!uploadLink) return;
    navigator.clipboard.writeText(uploadLink);
    toast.success("Upload link copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Request Document from Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading clients..." : "Select client"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
              <SelectContent>
                {documentRequestTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="Custom">Custom (type your own)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <div className="space-y-2">
              <Label>Custom Document Label</Label>
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Rent Agreement" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Submission Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {clientId && docType && dueDate && (
            <div className="space-y-2">
              <div className="rounded-xl bg-[#dcf8c6] p-3 text-sm text-foreground border border-[#25D366]/20">
                <p className="font-medium text-xs text-[#25D366] mb-1">WhatsApp Preview</p>
                <p>Hello {client?.name}, Sharma & Associates requires your {isCustom ? customLabel : docType} by {new Date(dueDate).toLocaleDateString("en-IN")}. Please upload here: {uploadLink}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-xs flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-mono truncate flex-1 text-[11px]">{uploadLink}</span>
                <button onClick={copyLink} className="text-primary hover:opacity-70"><Copy className="h-3.5 w-3.5" /></button>
              </div>
              <p className="text-[10px] text-muted-foreground">Public, no-login link · auto-marks task checklist on upload.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {sending ? "Creating..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
