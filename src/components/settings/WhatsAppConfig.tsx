import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { Loader2, MessageCircle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

// WhatsApp sending always goes through the platform's own Meta Cloud API
// credentials (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID function
// secrets — see supabase/functions/send-whatsapp) — there is no per-firm
// WATI/Twilio integration anywhere in this codebase for a firm to connect.
// This card used to let a firm type in WATI/Twilio credentials and click
// "Test Connection", which always reported success regardless of what was
// typed (ISSUES.md — the WhatsAppConfig fake Test Connection bug) because
// nothing downstream ever read those fields. "Test Connection" now checks
// the real, shared Meta credentials via the whatsapp-test-connection edge
// function instead of pretending to validate a firm-specific integration
// that was never wired up.
interface ConnectionStatus {
  connected: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  error?: string;
}

const defaultNotifications = {
  deadlineReminders: true,
  documentReceived: true,
  paymentReceived: false,
  taskAssigned: true,
};

export function WhatsAppConfig() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [reminderDays, setReminderDays] = useState("7");

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: staffRow } = await supabase.from("staff").select("firm_id").eq("auth_user_id", user.id).single();
        if (!staffRow?.firm_id) return;
        const { data: firm } = await supabase.from("firms").select("whatsapp_config").eq("id", staffRow.firm_id).single();
        const cfg = firm?.whatsapp_config as { notifications?: typeof defaultNotifications; reminder_days?: number } | null;
        if (cfg?.notifications) setNotifications({ ...defaultNotifications, ...cfg.notifications });
        if (cfg?.reminder_days != null) setReminderDays(String(cfg.reminder_days));
      } catch {
        // No saved preferences yet — defaults stand.
      } finally {
        setLoadingPrefs(false);
      }
    };
    loadPrefs();
  }, []);

  const testConnection = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-test-connection");
      if (error) throw error;
      if (!data?.connected) {
        const failure: ConnectionStatus = { connected: false, error: data?.error ?? "Connection check failed" };
        setStatus(failure);
        toast.error(failure.error!);
        return;
      }
      setStatus(data);
      toast.success(`Connected to ${data.displayPhoneNumber ?? "WhatsApp Business"}`);
    } catch (err: any) {
      const failure: ConnectionStatus = { connected: false, error: err.message ?? "Unable to reach WhatsApp Business API" };
      setStatus(failure);
      toast.error(failure.error!);
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
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
          <CardDescription>
            Messages send through CA Munim's shared WhatsApp Business connection — nothing to configure here, just verify it's live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={testConnection} variant="outline" disabled={checking} className="gap-2" style={{ borderColor: "#25D366", color: "#25D366" }}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Test Connection
            </Button>
            {status?.connected && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected — {status.displayPhoneNumber}{status.qualityRating ? ` (${status.qualityRating})` : ""}
              </span>
            )}
            {status && !status.connected && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {status.error}
              </span>
            )}
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
              <Switch
                checked={notifications[item.key as keyof typeof notifications]}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, [item.key]: v }))}
                disabled={loadingPrefs}
              />
            </div>
          ))}

          {notifications.deadlineReminders && (
            <div className="pt-2 border-t">
              <Label>Reminder Lead Time</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm text-muted-foreground">Send reminders</span>
                <Input className="w-16 text-center" type="number" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} disabled={loadingPrefs} />
                <span className="text-sm text-muted-foreground">days before due date</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || loadingPrefs} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save WhatsApp Settings
        </Button>
      </div>
    </div>
  );
}
