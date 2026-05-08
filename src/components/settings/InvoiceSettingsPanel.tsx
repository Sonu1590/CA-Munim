import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Receipt, Save, Upload, Loader2 } from "lucide-react";
import { fetchInvoiceSettingsFromSupabase, saveInvoiceSettingsToSupabase, type InvoiceSettings } from "@/data/Settings";
import { toast } from "sonner";

export function InvoiceSettingsPanel() {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInvoiceSettingsFromSupabase();
        setSettings(data);
      } catch (err: any) {
        setError(err.message ?? "Unable to load invoice settings");
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateField = (field: keyof InvoiceSettings, value: string | number | boolean) => {
    if (!settings) return;
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveInvoiceSettingsToSupabase(settings);
      toast.success("Invoice settings saved");
    } catch (err: any) {
      toast.error(err.message ?? "Unable to save invoice settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" />Loading invoice settings...</div>
    );
  }

  if (error) {
    return <div className="text-center text-destructive py-16">{error}</div>;
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Receipt className="h-5 w-5 text-primary" />Invoice Configuration</CardTitle>
          <CardDescription>Customize your invoice numbering, terms, and appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number Prefix</Label>
              <Input className="mt-1.5 font-mono" value={settings.prefix} onChange={(e) => updateField("prefix", e.target.value.toUpperCase())} />
              <p className="text-xs text-muted-foreground mt-1">Preview: {settings.prefix}-2526-001</p>
            </div>
            <div>
              <Label>GST Rate on Fees (%)</Label>
              <Input className="mt-1.5" type="number" value={settings.gstRate} onChange={(e) => updateField("gstRate", Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Reset Invoice Numbers Per Financial Year</p>
              <p className="text-xs text-muted-foreground">Start from 001 at the beginning of each FY (recommended)</p>
            </div>
            <Switch checked={settings.resetPerFY} onCheckedChange={(v) => updateField("resetPerFY", v)} />
          </div>

          <div>
            <Label>Default Payment Terms</Label>
            <Input className="mt-1.5" value={settings.paymentTerms} onChange={(e) => updateField("paymentTerms", e.target.value)} />
          </div>

          <div>
            <Label>Invoice Footer Notes</Label>
            <Textarea className="mt-1.5" rows={2} value={settings.footerNotes} onChange={(e) => updateField("footerNotes", e.target.value)} />
          </div>

          <div>
            <Label>Signatory Name</Label>
            <Input className="mt-1.5" value={settings.signatoryName} onChange={(e) => updateField("signatoryName", e.target.value)} />
          </div>

          <div>
            <Label>Signature Image</Label>
            <div className="mt-1.5 flex items-center gap-4">
              <div className="h-16 w-32 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border-2 border-dashed border-border text-xs">
                <Upload className="h-4 w-4 mr-1" />Upload
              </div>
              <Button variant="outline" size="sm">Choose File</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />Save Invoice Settings
        </Button>
      </div>
    </div>
  );
}
