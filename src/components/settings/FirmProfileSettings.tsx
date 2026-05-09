import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save, Upload, Loader2 } from "lucide-react";
import { fetchFirmProfileFromSupabase, saveFirmProfileToSupabase, type FirmProfile } from "@/data/Settings";
import { toast } from "sonner";

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Jammu & Kashmir", "Ladakh",
  "Chandigarh", "Puducherry", "Andaman & Nicobar", "Dadra & Nagar Haveli", "Lakshadweep",
];

export function FirmProfileSettings() {
  const [profile, setProfile] = useState<FirmProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFirmProfileFromSupabase();
        setProfile(data);
      } catch (err: any) {
        setError(err.message ?? "Unable to load firm profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await saveFirmProfileToSupabase(profile);
      toast.success("Firm profile updated successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Unable to save firm profile");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof FirmProfile, value: string) => {
    if (!profile) return;
    setProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />Loading firm profile...
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-destructive py-16">{error}</div>;
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Firm Details
          </CardTitle>
          <CardDescription>Your firm's basic information displayed on invoices and client-facing pages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload */}
          <div>
            <Label>Firm Logo</Label>
            <div className="mt-1.5 flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground border-2 border-dashed border-border">
                <Upload className="h-5 w-5" />
              </div>
              <Button variant="outline" size="sm">Upload Logo</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Firm Name</Label>
              <Input
                className="mt-1.5"
                value={profile.firmName}
                onChange={(e) => updateField("firmName", e.target.value)}
                disabled={profile.practiceType === "solo"}
                placeholder={profile.practiceType === "solo" ? "Solo practitioner — no firm name needed" : ""}
              />
              {profile.practiceType === "solo" && (
                <p className="text-xs text-muted-foreground mt-1">Firm name is not required for solo practitioners.</p>
              )}
            </div>
            <div><Label>CA Name</Label><Input className="mt-1.5" value={profile.caName} onChange={(e) => updateField("caName", e.target.value)} /></div>
            <div><Label>ICAI Membership No.</Label><Input className="mt-1.5 font-mono" value={profile.icaiMembershipNo} onChange={(e) => updateField("icaiMembershipNo", e.target.value)} /></div>
            <div><Label>Phone</Label><Input className="mt-1.5" value={profile.phone} onChange={(e) => updateField("phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input className="mt-1.5" type="email" value={profile.email} onChange={(e) => updateField("email", e.target.value)} /></div>
          </div>

          <div><Label>Address</Label><Textarea className="mt-1.5" rows={2} value={profile.address} onChange={(e) => updateField("address", e.target.value)} /></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>City</Label><Input className="mt-1.5" value={profile.city} onChange={(e) => updateField("city", e.target.value)} /></div>
            <div>
              <Label>State</Label>
              <Select value={profile.state} onValueChange={(v) => updateField("state", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{indianStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>PIN Code</Label><Input className="mt-1.5" value={profile.pinCode} onChange={(e) => updateField("pinCode", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tax & Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Firm PAN</Label><Input className="mt-1.5 font-mono uppercase" value={profile.firmPan} onChange={(e) => updateField("firmPan", e.target.value.toUpperCase())} /></div>
            <div><Label>Firm GSTIN</Label><Input className="mt-1.5 font-mono uppercase" value={profile.firmGstin || ""} onChange={(e) => updateField("firmGstin", e.target.value.toUpperCase())} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bank Details</CardTitle>
          <CardDescription>Used for payment receipts and invoice generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Bank Name</Label><Input className="mt-1.5" value={profile.bankName} onChange={(e) => updateField("bankName", e.target.value)} /></div>
            <div><Label>Account Name</Label><Input className="mt-1.5" value={profile.accountName} onChange={(e) => updateField("accountName", e.target.value)} /></div>
            <div><Label>Account Number</Label><Input className="mt-1.5 font-mono" value={profile.accountNumber} onChange={(e) => updateField("accountNumber", e.target.value)} /></div>
            <div><Label>IFSC Code</Label><Input className="mt-1.5 font-mono uppercase" value={profile.ifscCode} onChange={(e) => updateField("ifscCode", e.target.value.toUpperCase())} /></div>
            <div><Label>Branch Name</Label><Input className="mt-1.5" value={profile.branchName} onChange={(e) => updateField("branchName", e.target.value)} /></div>
            <div><Label>UPI ID</Label><Input className="mt-1.5 font-mono" value={profile.upiId || ""} onChange={(e) => updateField("upiId", e.target.value)} placeholder="yourfirm@bank" /></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save Firm Profile
        </Button>
      </div>
    </div>
  );
}
