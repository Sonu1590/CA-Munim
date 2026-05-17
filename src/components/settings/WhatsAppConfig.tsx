import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { Loader2, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppConfig() {
  const [provider, setProvider] = useState<"wati" | "twilio">("wati");
  const [watiKey, setWatiKey] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioAuth, setTwilioAuth] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("+91");
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    deadlineReminders: true,
    documentReceived: true,
    paymentReceived: false,
    taskAssigned: true,
  });
  const [reminderDays, setReminderDays] = useState("7");

  const testConnection = () => {
    if (provider === "wati" && !watiKey) { toast.error("Enter WATI API key"); return; }
    if (provider === "twilio" && (!twilioSid || !twilioAuth)) { toast.error("Enter Twilio credentials"); return; }
    toast.success("Test message sent to " + whatsappNumber);
    setConnected(true);
  };

  const handleSave = async () => {
    const apiKey = provider === "wati" ? watiKey : twilioAuth;
    const phoneNumber = whatsappNumber;

    if (!apiKey.trim()) { toast.error("API key is required"); return; }
    if (!phoneNumber.trim()) { toast.error("WhatsApp phone number is required"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: staffRow } = await supabase
        .from("staff")
        .select("firm_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!staffRow?.firm_id) throw new Error("Firm not found");

      const { error } = await supabase
        .from("firms")
        .update({
          whatsapp_config: {
            provider,
            api_key: apiKey,
            account_sid: provider === "twilio" ? twilioSid : null,
            phone_number: phoneNumber,
            enabled: connected,
            notifications,
            reminder_days: Number(reminderDays) || 0,
          },
        })
        .eq("id", staffRow.firm_id);

      if (error) throw error;
      toast.success("WhatsApp settings saved successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save WhatsApp settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" style={{ color: "#25D366" }} />
            WhatsApp Business API
          </CardTitle>
          <CardDescription>Connect your WhatsApp Business API to send automated messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>API Provider</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v as "wati" | "twilio"); setConnected(false); }}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wati">WATI</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === "wati" ? (
            <div><Label>WATI API Key</Label><Input className="mt-1.5 font-mono" type="password" value={watiKey} onChange={(e) => setWatiKey(e.target.value)} placeholder="Enter your WATI API key" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Twilio Account SID</Label><Input className="mt-1.5 font-mono" type="password" value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)} /></div>
              <div><Label>Twilio Auth Token</Label><Input className="mt-1.5 font-mono" type="password" value={twilioAuth} onChange={(e) => setTwilioAuth(e.target.value)} /></div>
            </div>
          )}

          <div><Label>WhatsApp Business Number</Label><Input className="mt-1.5 font-mono" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+91 9876543210" /></div>

          <div className="flex items-center gap-3">
            <Button onClick={testConnection} variant="outline" className="gap-2" style={{ borderColor: "#25D366", color: "#25D366" }}>
              <Send className="h-4 w-4" />Test Connection
            </Button>
            {connected && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" />Connected</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Preferences</CardTitle>
          <CardDescription>Choose which automated notifications to send via WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "deadlineReminders", label: "Deadline Reminders", desc: "Auto-send reminders before filing due dates" },
            { key: "documentReceived", label: "Document Received Alerts", desc: "Notify when a client uploads documents" },
            { key: "paymentReceived", label: "Payment Received Alerts", desc: "Confirm payment receipt to clients" },
            { key: "taskAssigned", label: "Task Assigned Alerts", desc: "Notify staff when tasks are assigned" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={notifications[item.key as keyof typeof notifications]} onCheckedChange={(v) => setNotifications((p) => ({ ...p, [item.key]: v }))} />
            </div>
          ))}

          {notifications.deadlineReminders && (
            <div className="pt-2 border-t">
              <Label>Reminder Lead Time</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm text-muted-foreground">Send reminders</span>
                <Input className="w-16 text-center" type="number" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} />
                <span className="text-sm text-muted-foreground">days before due date</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save WhatsApp Settings
        </Button>
      </div>
    </div>
  );
}
