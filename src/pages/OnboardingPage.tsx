import { useEffect, useState } from "react";
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

type PracticeType = "firm" | "solo";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu & Kashmir",
  "Ladakh","Puducherry","Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu","Lakshadweep","Andaman & Nicobar Islands",
];

// Validate Indian phone number
const isValidPhone = (p: string) => p === "" || /^[6-9]\d{9}$/.test(p);

// Validate ICAI membership number (4-6 digits)
const isValidICAI = (n: string) => n === "" || /^\d{4,6}$/.test(n);

interface OnboardingPageProps {
  onComplete?: () => void;
}

const Field = ({
  id, label, required, optional, children, error,
}: {
  id: string; label: string; required?: boolean; optional?: boolean;
  children: React.ReactNode; error?: string;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
      {optional && <span className="text-muted-foreground text-xs ml-1">(optional)</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [practiceType, setPracticeType] = useState<PracticeType | null>(null);

  const [caName, setCaName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [icaiNumber, setIcaiNumber] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Field-level errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;

    const loadSignupMetadata = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      const metadata = user.user_metadata ?? {};
      const metadataCaName = String(metadata.ca_name || metadata.full_name || metadata.name || "").trim();
      const metadataFirmName = String(metadata.firm_name || "").trim();
      const metadataIcaiNumber = String(metadata.icai_number || "").replace(/\D/g, "").slice(0, 6);
      const metadataPracticeType = metadata.practice_type === "solo" ? "solo" : metadataFirmName ? "firm" : null;

      if (metadataCaName) setCaName((current) => current || metadataCaName);
      if (metadataFirmName) setFirmName((current) => current || metadataFirmName);
      if (metadataIcaiNumber) setIcaiNumber((current) => current || metadataIcaiNumber);
      if (metadataPracticeType) setPracticeType((current) => current ?? metadataPracticeType);
    };

    loadSignupMetadata();

    return () => {
      mounted = false;
    };
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!caName.trim()) newErrors.caName = "Your name is required.";
    else if (caName.trim().length < 2) newErrors.caName = "Name must be at least 2 characters.";

    if (practiceType === "firm") {
      if (!firmName.trim()) newErrors.firmName = "Firm name is required.";
      else if (firmName.trim().length < 2) newErrors.firmName = "Firm name must be at least 2 characters.";
    }

    if (!isValidPhone(phone)) newErrors.phone = "Enter a valid 10-digit Indian mobile number.";
    if (!isValidICAI(icaiNumber)) newErrors.icaiNumber = "ICAI number should be 4–6 digits.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!practiceType) {
      toast.error("Please select how you practice.");
      return;
    }
    setStep(2);
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Session expired. Please sign in again.");

      // Find the firm_id via staff record (NOT by user.id — firms have their own UUID)
      const { data: staffRow, error: staffError } = await supabase
        .from("staff")
        .select("firm_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (staffError) throw staffError;

      if (!staffRow?.firm_id) {
        throw new Error(
          "Your account setup is incomplete. Please sign out and sign back in, or contact support at hello@camunim.in"
        );
      }

      const firmId = staffRow.firm_id;
      const displayName = practiceType === "firm" ? firmName.trim() : caName.trim();

      // Update the EXISTING firms row by its actual firm_id
      const { error: updateError } = await supabase
        .from("firms")
        .update({
          name: displayName,
          ca_name: caName.trim(),
          icai_number: icaiNumber.trim() || null,
          city: city || null,
          state: state || null,
          phone: phone.trim() || null,
          practice_type: practiceType,
          onboarding_complete: true,
        })
        .eq("id", firmId);  // ← Uses the REAL firm UUID, not user.id

      if (updateError) throw updateError;

      // Update staff name to match
      await supabase
        .from("staff")
        .update({ name: caName.trim() })
        .eq("auth_user_id", user.id);

      toast.success("Profile saved! Welcome to CA Munim.");
      onComplete?.();
      navigate("/", { replace: true });

    } catch (err: any) {
      const msg = err?.message ?? "Failed to save. Please try again.";
      if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("policy")) {
        toast.error("Permission error. Please sign out and sign back in, then try again.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary mb-4">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold">Welcome to CA Munim</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up your practice profile — takes 2 minutes
          </p>
        </div>

        {/* Progress */}
        <div className="flex justify-center gap-2 mb-6">
          <div className={cn("h-2 rounded-full transition-all duration-300",
            step === 1 ? "w-8 bg-primary" : "w-2 bg-primary")} />
          <div className={cn("h-2 rounded-full transition-all duration-300",
            step === 2 ? "w-8 bg-primary" : "w-2 bg-primary/30")} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">

          {/* ── Step 1: Practice type ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-heading font-semibold">How do you practice?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This personalises your experience throughout the app.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    type: "firm" as PracticeType,
                    icon: Building2,
                    title: "CA Firm",
                    desc: "Registered firm with partners or staff",
                  },
                  {
                    type: "solo" as PracticeType,
                    icon: User,
                    title: "Solo Practitioner",
                    desc: "Individual CA practising in own name",
                  },
                ].map(({ type, icon: Icon, title, desc }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPracticeType(type)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all text-center",
                      practiceType === type
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                      practiceType === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    {practiceType === type && (
                      <span className="text-xs font-semibold text-primary">✓ Selected</span>
                    )}
                  </button>
                ))}
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

          {/* ── Step 2: Details ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-heading font-semibold">
                  {practiceType === "firm" ? "Firm Details" : "Your Details"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {practiceType === "firm"
                    ? "Tell us about your firm. This appears on invoices and client-facing pages."
                    : "Tell us about yourself. This appears on invoices and client-facing pages."}
                </p>
              </div>

              {practiceType === "firm" && (
                <Field id="firmName" label="Firm Name" required error={errors.firmName}>
                  <Input
                    id="firmName"
                    placeholder="e.g. Sharma & Associates"
                    value={firmName}
                    onChange={(e) => { setFirmName(e.target.value); setErrors(p => ({...p, firmName: ""})); }}
                    className={errors.firmName ? "border-destructive" : ""}
                  />
                </Field>
              )}

              <Field id="caName" label="Your Full Name" required error={errors.caName}>
                <Input
                  id="caName"
                  placeholder={practiceType === "firm" ? "e.g. CA Rajesh Sharma" : "e.g. CA First Name  Last Name"}
                  value={caName}
                  onChange={(e) => { setCaName(e.target.value); setErrors(p => ({...p, caName: ""})); }}
                  className={errors.caName ? "border-destructive" : ""}
                />
              </Field>

              <Field id="icai" label="ICAI Membership Number" optional error={errors.icaiNumber}>
                <Input
                  id="icai"
                  placeholder="e.g. 123456"
                  value={icaiNumber}
                  maxLength={6}
                  onChange={(e) => { setIcaiNumber(e.target.value.replace(/\D/g, "")); setErrors(p => ({...p, icaiNumber: ""})); }}
                  className={errors.icaiNumber ? "border-destructive" : ""}
                />
              </Field>

              <Field id="phone" label="Phone Number" optional error={errors.phone}>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  maxLength={10}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setErrors(p => ({...p, phone: ""})); }}
                  className={errors.phone ? "border-destructive" : ""}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field id="city" label="City" optional>
                  <Input
                    id="city"
                    placeholder="e.g. Pune"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </Field>
                <Field id="state" label="State" optional>
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
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 h-11 bg-accent hover:bg-accent/90 text-white"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                  ) : (
                    "Save & Get Started"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can update all details anytime in Settings.
        </p>
      </div>
    </div>
  );
}
