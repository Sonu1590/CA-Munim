import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Receipt, Save, Upload } from "lucide-react";
import { mockInvoiceSettings } from "@/data/mockSettings";
import { toast } from "sonner";

export function InvoiceSettingsPanel() {
  const [settings, setSettings] = useState(mockInvoiceSettings);

  const updateField = (field: string, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

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
        <Button onClick={() => toast.success("Invoice settings saved")} className="gap-2"><Save className="h-4 w-4" />Save Invoice Settings</Button>
      </div>
    </div>
  );
}
