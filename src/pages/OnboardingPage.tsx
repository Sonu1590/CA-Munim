import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, User, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const extractSupabaseError = (err: any): string => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  if (typeof err.error === "string") return err.error;
  if (typeof err.details === "string") return err.details;
  if (typeof err.hint === "string") return err.hint;
  return String(err);
};

const getOnboardingErrorMessage = (error: any) => {
  const message = extractSupabaseError(error).toLowerCase();
  if (message.includes("row-level security") || message.includes("policy")) {
    return "Unable to save your profile because of permissions. Please sign out and sign in again or contact support.";
  }
  return extractSupabaseError(error) || "Failed to save profile. Please try again.";
};

type PracticeType = "firm" | "solo";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry", "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu", "Lakshadweep", "Andaman & Nicobar Islands",
];

interface OnboardingPageProps {
  onComplete?: () => void;}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const navigate = useNavigate();

  // Step 1 — practice type
  const [step, setStep] = useState<1 | 2>(1);
  const [practiceType, setPracticeType] = useState<PracticeType | null>(null);

  // Step 2 — details
  const [caName, setCaName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [icaiNumber, setIcaiNumber] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (!practiceType) {
      toast.error("Please select how you practice.");
      return;
    }
    setStep(2);
  };

  const handleSave = async () => {
    if (!caName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (practiceType === "firm" && !firmName.trim()) {
      toast.error("Please enter your firm name.");
      return;
    }

    const displayName = practiceType === "firm"
      ? firmName.trim()
      : caName.trim();

    if (!displayName) {
      toast.error("Please enter a firm or practitioner name.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!user.email) throw new Error("Signed-in account is missing an email address.");

      const row = {
        id: user.id,
        name: practiceType === "firm" ? firmName.trim() : "",
        ca_name: caName.trim(),
        email: user.email,
        icai_number: icaiNumber.trim() || null,
        city: city || null,
        state: state || null,
        phone: phone.trim() || null,
        practice_type: practiceType,
        onboarding_complete: true,
        created_at: new Date().toISOString(),
      };

      const { data: upsertData, error: upsertError } = await supabase
        .from("firms")
        .upsert(row, { onConflict: "id" });

      if (upsertError) {
        const message = extractSupabaseError(upsertError).toLowerCase();
        if (message.includes("firms_email_unique") || message.includes("duplicate key value")) {
          throw new Error("A firm profile already exists for this email address. Please sign out and sign in again or contact support.");
        }
        throw upsertError;
      }

      // Update or create staff record with the onboarded name.
      const { error: staffErr } = await supabase
        .from("staff")
        .upsert(
          {
            firm_id: user.id,
            name: caName.trim(),
            email: user.email,
            auth_user_id: user.id,
            role: "admin",
            active: true,
            created_at: new Date().toISOString(),
          },
          { onConflict: "auth_user_id" }
        );

      if (staffErr) {
        console.warn("Unable to upsert staff during onboarding:", staffErr);
      }

      toast.success("Profile saved! Welcome to CA Munim.");
      onComplete?.();           // ← tells App.tsx state to update immediately
      navigate("/", { replace: true });

    } catch (err: any) {
      toast.error(getOnboardingErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary mb-4">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold">Welcome to CA Munim</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Let's set up your practice profile — takes 2 minutes
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          <div className={cn("h-2 rounded-full transition-all", step === 1 ? "w-8 bg-primary" : "w-2 bg-primary/30")} />
          <div className={cn("h-2 rounded-full transition-all", step === 2 ? "w-8 bg-primary" : "w-2 bg-primary/30")} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">

          {/* ── STEP 1: Practice type ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-heading font-semibold">How do you practice?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This helps us personalise your experience.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Firm option */}
                <button
                  type="button"
                  onClick={() => setPracticeType("firm")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all text-center",
                    practiceType === "firm"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center",
                    practiceType === "firm" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">CA Firm</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Registered firm with partners or staff
                    </p>
                  </div>
                  {practiceType === "firm" && (
                    <span className="text-xs font-medium text-primary">✓ Selected</span>
                  )}
                </button>

                {/* Solo option */}
                <button
                  type="button"
                  onClick={() => setPracticeType("solo")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all text-center",
                    practiceType === "solo"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center",
                    practiceType === "solo" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Solo Practitioner</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Individual CA practising in own name
                    </p>
                  </div>
                  {practiceType === "solo" && (
                    <span className="text-xs font-medium text-primary">✓ Selected</span>
                  )}
                </button>
              </div>

              <Button
                onClick={handleNext}
                disabled={!practiceType}
                className="w-full h-11 bg-accent hover:bg-accent/90 text-white"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* ── STEP 2: Details form ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-heading font-semibold">
                  {practiceType === "firm" ? "Firm Details" : "Your Details"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {practiceType === "firm"
                    ? "Tell us about your firm."
                    : "Tell us about yourself."}
                </p>
              </div>

              {/* Firm name — only for firm type */}
              {practiceType === "firm" && (
                <div className="space-y-1.5">
                  <Label htmlFor="firmName">
                    Firm Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firmName"
                    placeholder="e.g. Sharma & Associates"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                  />
                </div>
              )}

              {/* CA Name */}
              <div className="space-y-1.5">
                <Label htmlFor="caName">
                  Your Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="caName"
                  placeholder="e.g. CA Rajesh Sharma"
                  value={caName}
                  onChange={(e) => setCaName(e.target.value)}
                />
              </div>

              {/* ICAI Number */}
              <div className="space-y-1.5">
                <Label htmlFor="icai">
                  ICAI Membership Number
                  <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                </Label>
                <Input
                  id="icai"
                  placeholder="e.g. 123456"
                  value={icaiNumber}
                  onChange={(e) => setIcaiNumber(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Phone Number
                  <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  maxLength={10}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              {/* City + State side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">
                    City
                    <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                  </Label>
                  <Input
                    id="city"
                    placeholder="e.g. Pune"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-none"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 h-11 bg-accent hover:bg-accent/90 text-white"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save & Get Started"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can update these details anytime in Settings.
        </p>
      </div>
    </div>
  );
}
