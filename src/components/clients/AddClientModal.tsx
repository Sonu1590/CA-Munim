import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Client, ClientFormData, ClientMutationResult, ClientType } from "@/hooks/useClients";
import { validatePAN, validateGSTIN } from "@/lib/indianTaxUtils";
import { FYHint } from "@/components/common/FYHint";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (formData: ClientFormData) => Promise<ClientMutationResult | boolean | void> | ClientMutationResult | boolean | void;
  client?: Client | null;
}

const clientTypes: ClientType[] = [
  "Individual", "HUF", "Sole Proprietor", "Partnership", "LLP",
  "Private Ltd", "Public Ltd", "Trust", "Society", "AOP", "BOI",
];

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Delhi", "Chandigarh", "Puducherry", "Ladakh",
  "Jammu and Kashmir", "Andaman and Nicobar", "Dadra and Nagar Haveli",
  "Lakshadweep",
];

const itrTypes = ["ITR-1", "ITR-2", "ITR-3", "ITR-4", "ITR-5", "ITR-6", "ITR-7"];

const services = [
  "ITR Filing (Annual)",
  "GST Returns (Monthly / Quarterly)",
  "TDS Returns (Quarterly)",
  "Bookkeeping",
  "ROC / MCA Compliance",
  "Tax Audit (u/s 44AB)",
  "GST Annual Return (GSTR-9)",
  "Company Incorporation",
  "Import Export Code (IEC)",
  "MSME Registration",
];

const rocJurisdictions = [
  "ROC Mumbai", "ROC Delhi", "ROC Bangalore", "ROC Chennai",
  "ROC Kolkata", "ROC Hyderabad", "ROC Ahmedabad", "ROC Pune", "ROC Jaipur",
];

const mcaFilings = ["MGT-7", "AOC-4", "DIR-3 KYC", "ADT-1", "INC-20A", "PAS-3"];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// M30, ISSUES.md — the only fields actually marked "*" (required) in the
// form below. Order matches their top-to-bottom DOM position in Section A
// so "scroll to first invalid field" lands on whichever one the user
// would hit first while reading the form.
const requiredFieldOrder = ["fullName", "clientType", "dob", "pan", "phone"] as const;

export function AddClientModal({ open, onOpenChange, onSave, client }: AddClientModalProps) {
  const [clientType, setClientType] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedMcaFilings, setSelectedMcaFilings] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [panValue, setPanValue] = useState("");
  const [gstinValue, setGstinValue] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pin, setPin] = useState("");
  const [dob, setDob] = useState("");
  const [gstRegDate, setGstRegDate] = useState("");
  const [gstTurnoverCategory, setGstTurnoverCategory] = useState("");
  const [gstFilingFreq, setGstFilingFreq] = useState("");
  const [gstOnFees, setGstOnFees] = useState(true);
  const [directorName, setDirectorName] = useState("");
  const [aadhaarValue, setAadhaarValue] = useState("");
  const [tanValue, setTanValue] = useState("");
  const [itaxWard, setItaxWard] = useState("");
  const [itrType, setItrType] = useState("");
  const [cinLlpin, setCinLlpin] = useState("");
  const [rocJurisdiction, setRocJurisdiction] = useState("");
  const [agmDueMonth, setAgmDueMonth] = useState("");
  const [lastAllotmentDate, setLastAllotmentDate] = useState("");
  const [annualFees, setAnnualFees] = useState("");
  const [billingFrequency, setBillingFrequency] = useState("");
  const [preferredPaymentMode, setPreferredPaymentMode] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const isCompanyType = ["Private Ltd", "LLP", "Public Ltd"].includes(clientType);
  const panCheck = validatePAN(panValue, clientType || undefined);
  const gstinCheck = validateGSTIN(gstinValue);

  // M30, ISSUES.md — single source of truth for what makes each required
  // field valid right now. Reads current state directly (not a passed-in
  // value) so it's safe to call from onBlur, from the touched-field
  // re-validation effect below, and from validateAll on submit alike.
  const validateField = (field: string): string | null => {
    switch (field) {
      case "fullName":
        return fullName.trim() ? null : "Full Name is required.";
      case "clientType":
        return clientType ? null : "Client Type is required.";
      case "dob":
        return dob ? null : "Date of Birth / Incorporation is required.";
      case "pan":
        if (!panValue.trim()) return "PAN Number is required.";
        return panCheck.isValid ? null : "Enter a valid PAN (format: AAAAA9999A — 5 letters, 4 digits, 1 letter).";
      case "phone":
        return phone.trim() ? null : "Phone is required.";
      default:
        return null;
    }
  };

  const touchField = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  // Re-validates only fields already touched (blurred at least once), so an
  // error clears live as the user fixes it without flashing errors on
  // fields they haven't reached yet.
  useEffect(() => {
    if (!open) return;
    setFieldErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const field of requiredFieldOrder) {
        if (!touched[field]) continue;
        const err = validateField(field);
        if ((err ?? null) !== (next[field] ?? null)) {
          changed = true;
          if (err) next[field] = err; else delete next[field];
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fullName, clientType, dob, panValue, panCheck.isValid, phone, touched]);

  const validateAll = () => {
    const next: Record<string, string> = {};
    for (const field of requiredFieldOrder) {
      const err = validateField(field);
      if (err) next[field] = err;
    }
    setTouched((prev) => {
      const nextTouched = { ...prev };
      for (const field of requiredFieldOrder) nextTouched[field] = true;
      return nextTouched;
    });
    setFieldErrors(next);
    return next;
  };

  const scrollToField = (field: string) => {
    const el = document.getElementById(field);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement | null)?.focus?.();
  };

  const toggleService = (service: string) => {
    setIsDirty(true);
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const toggleMcaFiling = (filing: string) => {
    setIsDirty(true);
    setSelectedMcaFilings((prev) =>
      prev.includes(filing) ? prev.filter((f) => f !== filing) : [...prev, filing]
    );
  };

  useEffect(() => {
    if (!open) return;
    const hasValue = [
      clientType, fullName, panValue, gstinValue, phone, altPhone, email, address,
      city, state, pin, dob, gstRegDate, gstTurnoverCategory, gstFilingFreq,
      directorName, aadhaarValue, tanValue, itaxWard, itrType, cinLlpin,
      rocJurisdiction, agmDueMonth, lastAllotmentDate, annualFees, billingFrequency, preferredPaymentMode,
    ].some(Boolean) || selectedServices.length > 0 || selectedMcaFilings.length > 0 || !gstOnFees;
    setIsDirty(hasValue);
  }, [
    open, clientType, fullName, panValue, gstinValue, phone, altPhone, email, address,
    city, state, pin, dob, gstRegDate, gstTurnoverCategory, gstFilingFreq, gstOnFees,
    directorName, aadhaarValue, tanValue, itaxWard, itrType, cinLlpin, rocJurisdiction,
    agmDueMonth, lastAllotmentDate, annualFees, billingFrequency, preferredPaymentMode, selectedServices,
    selectedMcaFilings,
  ]);

  const resetForm = () => {
    setClientType("");
    setSelectedServices([]);
    setSelectedMcaFilings([]);
    setFullName("");
    setPanValue("");
    setGstinValue("");
    setPhone("");
    setAltPhone("");
    setEmail("");
    setAddress("");
    setCity("");
    setState("");
    setPin("");
    setDob("");
    setGstRegDate("");
    setGstTurnoverCategory("");
    setGstFilingFreq("");
    setGstOnFees(true);
    setDirectorName("");
    setAadhaarValue("");
    setTanValue("");
    setItaxWard("");
    setItrType("");
    setCinLlpin("");
    setRocJurisdiction("");
    setAgmDueMonth("");
    setLastAllotmentDate("");
    setAnnualFees("");
    setBillingFrequency("");
    setPreferredPaymentMode("");
    setIsDirty(false);
    setError(null);
    setFieldErrors({});
    setTouched({});
  };

  useEffect(() => {
    if (!open) return;

    setClientType(client?.type ?? "");
    setSelectedServices(client?.servicesSubscribed ?? []);
    setSelectedMcaFilings(client?.mca_filings ?? []);
    setFullName(client?.name ?? "");
    setPanValue(client?.pan ?? "");
    setGstinValue(client?.gstin ?? "");
    setPhone(client?.phone ?? "");
    setAltPhone(client?.alt_phone ?? "");
    setEmail(client?.email ?? "");
    setAddress(client?.address ?? "");
    setCity(client?.city ?? "");
    setState(client?.state ?? "");
    setPin(client?.pin ?? "");
    setDob(client?.date_of_birth ?? "");
    setGstRegDate(client?.gst_reg_date ?? "");
    setGstTurnoverCategory(client?.gst_turnover_category ?? "");
    setGstFilingFreq(client?.gst_filing_freq ?? "");
    setGstOnFees(client?.gst_on_fees ?? true);
    setDirectorName(client?.directors?.[0]?.name ?? "");
    setAadhaarValue(client?.aadhaar_masked ?? "");
    setTanValue(client?.tan ?? "");
    setItaxWard(client?.itax_ward ?? "");
    setItrType(client?.itr_type ?? "");
    setCinLlpin(client?.cin_llpin ?? "");
    setRocJurisdiction(client?.roc_jurisdiction ?? "");
    setAgmDueMonth(client?.agm_due_month ? String(client.agm_due_month) : "");
    setLastAllotmentDate(client?.last_allotment_date ?? "");
    setAnnualFees(client?.annual_fees ? String(client.annual_fees) : "");
    setBillingFrequency(client?.billing_frequency ?? "");
    setPreferredPaymentMode(client?.preferred_payment_mode ?? "");
    setError(null);
    setIsDirty(false);
    setFieldErrors({});
    setTouched({});
  }, [open, client]);

  // M32, ISSUES.md — was a raw window.confirm(); now the AlertDialog
  // rendered alongside the main Dialog below. The main Dialog stays open
  // while this confirmation is pending — it only actually closes on
  // confirmDiscardClose.
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setConfirmCloseOpen(true);
      return;
    }
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const confirmDiscardClose = () => {
    setConfirmCloseOpen(false);
    resetForm();
    onOpenChange(false);
  };

  const handleSave = async () => {
    setError(null);
    const errs = validateAll();
    const firstInvalid = requiredFieldOrder.find((field) => errs[field]);
    if (firstInvalid) {
      scrollToField(firstInvalid);
      return;
    }

    if (!onSave) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      const result = await onSave({
        name: fullName.trim(),
        type: (clientType || "Individual") as ClientType,
        pan: panValue,
        phone,
        alt_phone: altPhone,
        email,
        date_of_birth: dob,
        address,
        city,
        state,
        pin,
        aadhaar_masked: aadhaarValue,
        gstin: gstinValue,
        gst_reg_date: gstRegDate,
        gst_turnover_category: gstTurnoverCategory,
        gst_filing_freq: gstFilingFreq,
        gst_on_fees: gstOnFees,
        tan: tanValue,
        itax_ward: itaxWard,
        itr_type: itrType,
        cin_llpin: cinLlpin,
        roc_jurisdiction: rocJurisdiction,
        directors: directorName.trim() ? [{ name: directorName.trim(), din: "" }] : [],
        agm_due_month: agmDueMonth ? Number(agmDueMonth) : undefined,
        last_allotment_date: lastAllotmentDate,
        services_subscribed: selectedServices,
        mca_filings: selectedMcaFilings,
        annual_fees: annualFees ? Number(annualFees) : 0,
        billing_frequency: billingFrequency,
        preferred_payment_mode: preferredPaymentMode,
      });
      if (result === false || (typeof result === "object" && result !== null && "success" in result && !result.success)) {
        setError(
          typeof result === "object" && result !== null && "error" in result && result.error
            ? result.error
            : "Could not save client. Please check the details and try again."
        );
        return;
      }
      resetForm();
    } catch (err: any) {
      setError(err?.message ?? "Could not save client. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* M35, ISSUES.md — `p-0` alone is silently overridden at every
          breakpoint: dialog.tsx's own `max-sm:p-5`/`sm:p-6` share no
          variant modifier with a bare `p-0`, so tailwind-merge (cn) keeps
          both instead of deduping, and Tailwind's CSS layer ordering
          means the responsive class wins the cascade regardless of
          intent. DialogHeader/section-nav/ScrollArea below all manage
          their own padding precisely because this was meant to be zero
          padding at any width — spelling it out per-breakpoint is what
          actually achieves that. */}
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 max-sm:p-0 sm:p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg font-heading">{client ? "Edit Client" : "Add New Client"}</DialogTitle>
          <DialogDescription className="sr-only">Enter the client's KYC, tax, and billing details.</DialogDescription>
        </DialogHeader>

        {/* Section jump nav (L9, ISSUES.md) — the form has 5 sections (A-E,
            C conditional) with heavy scrolling and no sense of position or
            how much remains. Plain anchor links + scrollIntoView rather than
            a scroll-spy "current section" indicator — simpler and lower-risk
            for a polish-tier fix, and still gives real navigational value. */}
        <div className="flex items-center gap-1 px-6 pb-2 text-xs font-medium text-muted-foreground">
          {(["a", "b", ...(isCompanyType ? ["c"] : []), "d", "e"] as const).map((letter) => (
            <a
              key={letter}
              href={`#section-${letter}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`section-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="h-6 w-6 flex items-center justify-center rounded-full border border-border hover:border-primary hover:text-primary transition-colors uppercase"
            >
              {letter}
            </a>
          ))}
        </div>

        <ScrollArea className="max-h-[75vh] px-6 pb-6">
          <div className="space-y-6 pt-4">
            {/* Section A: Basic Details */}
            <section id="section-a">
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                A. Basic Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    autoFocus
                    placeholder="Client name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => touchField("fullName")}
                    className={cn(fieldErrors.fullName && "border-destructive focus-visible:ring-destructive")}
                  />
                  {fieldErrors.fullName && <p className="text-[11px] text-destructive mt-1">{fieldErrors.fullName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientType">Client Type *</Label>
                  <Select value={clientType} onValueChange={(v) => { setClientType(v); touchField("clientType"); }}>
                    <SelectTrigger
                      id="clientType"
                      onBlur={() => touchField("clientType")}
                      className={cn(fieldErrors.clientType && "border-destructive focus-visible:ring-destructive")}
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.clientType && <p className="text-[11px] text-destructive mt-1">{fieldErrors.clientType}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fatherName">Father's / Director's Name</Label>
                  <Input id="fatherName" placeholder="Optional" value={directorName} onChange={(e) => setDirectorName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob">Date of Birth / Incorporation *</Label>
                  <DatePickerField
                    id="dob"
                    value={dob}
                    onChange={(value) => {
                      setIsDirty(true);
                      setDob(value);
                    }}
                    onBlur={() => touchField("dob")}
                    placeholder="dd/mm/yyyy"
                    className={cn(fieldErrors.dob && "border-destructive focus-visible:ring-destructive")}
                  />
                  <FYHint date={dob} />
                  {fieldErrors.dob && <p className="text-[11px] text-destructive mt-1">{fieldErrors.dob}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pan">PAN Number *</Label>
                  <div className="relative">
                    <Input
                      id="pan"
                      className={cn("font-mono uppercase tracking-wider pr-9", fieldErrors.pan && "border-destructive focus-visible:ring-destructive")}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      value={panValue}
                      onChange={(e) => setPanValue(e.target.value.toUpperCase())}
                      onBlur={() => touchField("pan")}
                    />
                    {panValue.length > 0 && (
                      panCheck.isValid ? (
                        <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--success))]" />
                      ) : (
                        <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                      )
                    )}
                  </div>
                  {panValue.length === 10 && panCheck.isValid && panCheck.entityType && !panCheck.clientTypeMismatch && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Entity type: <span className="font-medium text-primary">{panCheck.entityType}</span>
                    </p>
                  )}
                  {panValue.length === 10 && panCheck.isValid && panCheck.unknownEntityCode && (
                    <p className="text-[11px] text-destructive mt-1">{panCheck.unknownEntityCode}</p>
                  )}
                  {panValue.length === 10 && panCheck.clientTypeMismatch && (
                    <p className="text-[11px] text-destructive mt-1">{panCheck.clientTypeMismatch}</p>
                  )}
                  {!panCheck.isValid && panValue.length === 10 && (
                    <p className="text-[11px] text-destructive mt-1">
                      Invalid PAN format (expected AAAAA9999A — 5 letters, 4 digits, 1 letter)
                    </p>
                  )}
                  {fieldErrors.pan && !panValue.trim() && (
                    <p className="text-[11px] text-destructive mt-1">{fieldErrors.pan}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aadhaar">Aadhaar Number</Label>
                  <Input id="aadhaar" placeholder="XXXX-XXXX-1234" maxLength={14} value={aadhaarValue} onChange={(e) => setAadhaarValue(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="10-digit mobile"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => touchField("phone")}
                    className={cn(fieldErrors.phone && "border-destructive focus-visible:ring-destructive")}
                  />
                  {fieldErrors.phone && <p className="text-[11px] text-destructive mt-1">{fieldErrors.phone}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="altPhone">Alternate Phone</Label>
                  <Input id="altPhone" type="tel" placeholder="Optional" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" placeholder="Full address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {indianStates.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pin">PIN Code</Label>
                  <Input id="pin" placeholder="6-digit PIN" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} />
                </div>
              </div>
            </section>

            <Separator />

            {/* Section B: Tax & Compliance */}
            <section id="section-b">
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                B. Tax & Compliance Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <div className="relative">
                    <Input
                      id="gstin"
                      className="font-mono uppercase tracking-wider pr-9"
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      value={gstinValue}
                      onChange={(e) => setGstinValue(e.target.value.toUpperCase())}
                    />
                    {gstinValue.length > 0 && (
                      gstinCheck.isValid ? (
                        <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--success))]" />
                      ) : (
                        <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                      )
                    )}
                  </div>
                  {gstinValue.length >= 2 && gstinCheck.stateName && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      State: <span className="font-medium text-primary">{gstinCheck.stateName}</span>
                      {!gstinCheck.isValid && gstinValue.length === 15 && (
                        <span className="text-destructive ml-2">· Invalid GSTIN format</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gstRegDate">GST Registration Date</Label>
                  <DatePickerField
                    id="gstRegDate"
                    value={gstRegDate}
                    onChange={(value) => {
                      setIsDirty(true);
                      setGstRegDate(value);
                    }}
                    placeholder="dd/mm/yyyy"
                  />
                  <FYHint date={gstRegDate} />
                </div>
                <div className="space-y-1.5">
                  <Label>GST Turnover Category</Label>
                  <Select value={gstTurnoverCategory} onValueChange={(v) => { setIsDirty(true); setGstTurnoverCategory(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Nil", "Up to ₹1.5cr", "₹1.5cr–5cr", "Above ₹5cr"].map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>GST Filing Frequency</Label>
                  <Select value={gstFilingFreq} onValueChange={(v) => { setIsDirty(true); setGstFilingFreq(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly (QRMP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tan">TAN Number</Label>
                  {/* No `uppercase` class (L7, ISSUES.md) — it applied
                      text-transform to the whole input including the
                      placeholder, rendering "Optional" as "OPTIONAL" and
                      breaking casing consistency with every other optional
                      field's placeholder. The typed value is already forced
                      uppercase via .toUpperCase() below, so the class was
                      redundant for real input and only affected the
                      placeholder. */}
                  <Input id="tan" className="font-mono" placeholder="Optional" value={tanValue} onChange={(e) => setTanValue(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ward">IT Ward / AO Code</Label>
                  <Input id="ward" placeholder="Optional" value={itaxWard} onChange={(e) => setItaxWard(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>ITR Type</Label>
                  <Select value={itrType} onValueChange={(v) => { setIsDirty(true); setItrType(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {itrTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Section C: Company / ROC (conditional) */}
            {isCompanyType && (
              <>
                <Separator />
                <section id="section-c">
                  <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                    C. Company / ROC Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="cin">CIN / LLPIN</Label>
                      <Input id="cin" className="font-mono uppercase" value={cinLlpin} onChange={(e) => setCinLlpin(e.target.value.toUpperCase())} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>ROC Jurisdiction</Label>
                      <Select value={rocJurisdiction} onValueChange={(v) => { setIsDirty(true); setRocJurisdiction(v); }}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {rocJurisdictions.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>AGM Due Month</Label>
                      <Select value={agmDueMonth} onValueChange={(v) => { setIsDirty(true); setAgmDueMonth(v); }}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {months.map((m, idx) => (
                            <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">Drives MGT-7/AOC-4/ADT-1 due dates.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastAllotmentDate">Last Share Allotment Date</Label>
                      <DatePickerField
                        id="lastAllotmentDate"
                        value={lastAllotmentDate}
                        onChange={(value) => {
                          setIsDirty(true);
                          setLastAllotmentDate(value);
                        }}
                        placeholder="dd/mm/yyyy"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Drives PAS-3 due date.</p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>MCA Filings Applicable</Label>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {mcaFilings.map((f) => (
                          <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer py-2.5 px-1 -mx-1">
                            <Checkbox
                              checked={selectedMcaFilings.includes(f)}
                              onCheckedChange={() => toggleMcaFiling(f)}
                            />
                            {f}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            <Separator />

            {/* Section D: Services Subscribed */}
            <section id="section-d">
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                D. Services Subscribed
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {services.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer py-2.5 px-1 -mx-1">
                    <Checkbox
                      checked={selectedServices.includes(s)}
                      onCheckedChange={() => toggleService(s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </section>

            <Separator />

            {/* Section E: Fees & Billing */}
            <section id="section-e">
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                E. Fees & Billing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="annualFees">Annual Fees (₹)</Label>
                  <Input id="annualFees" type="number" placeholder="₹" value={annualFees} onChange={(e) => setAnnualFees(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>GST on Fees (18%)</Label>
                  <Select value={gstOnFees ? "Yes" : "No"} onValueChange={(v) => { setIsDirty(true); setGstOnFees(v === "Yes"); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Frequency</Label>
                  <Select value={billingFrequency} onValueChange={(v) => { setIsDirty(true); setBillingFrequency(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Monthly", "Quarterly", "Annually", "Per Task"].map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Mode</Label>
                  <Select value={preferredPaymentMode} onValueChange={(v) => { setIsDirty(true); setPreferredPaymentMode(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["UPI", "Bank Transfer", "Cash", "Cheque"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Actions */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2 pb-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : client ? "Update Client" : "Save Client"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Close anyway?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscardClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
