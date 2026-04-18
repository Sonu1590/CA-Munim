import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ClientType } from "@/data/mockClients";
import { validatePAN, validateGSTIN } from "@/lib/indianTaxUtils";
import { FYHint } from "@/components/common/FYHint";
import { CheckCircle2, XCircle } from "lucide-react";

interface AddClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AddClientModal({ open, onOpenChange }: AddClientModalProps) {
  const [clientType, setClientType] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedMcaFilings, setSelectedMcaFilings] = useState<string[]>([]);
  const [panValue, setPanValue] = useState("");
  const [gstinValue, setGstinValue] = useState("");
  const [dob, setDob] = useState("");
  const [gstRegDate, setGstRegDate] = useState("");
  const [compRegDate, setCompRegDate] = useState("");

  const isCompanyType = ["Private Ltd", "LLP", "Public Ltd"].includes(clientType);
  const panCheck = validatePAN(panValue);
  const gstinCheck = validateGSTIN(gstinValue);

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const toggleMcaFiling = (filing: string) => {
    setSelectedMcaFilings((prev) =>
      prev.includes(filing) ? prev.filter((f) => f !== filing) : [...prev, filing]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg font-heading">Add New Client</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] px-6 pb-6">
          <div className="space-y-6 pt-4">
            {/* Section A: Basic Details */}
            <section>
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                A. Basic Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" placeholder="Client name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Client Type *</Label>
                  <Select value={clientType} onValueChange={setClientType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {clientTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fatherName">Father's / Director's Name</Label>
                  <Input id="fatherName" placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob">Date of Birth / Incorporation</Label>
                  <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  <FYHint date={dob} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pan">PAN Number *</Label>
                  <div className="relative">
                    <Input
                      id="pan"
                      className="font-mono uppercase tracking-wider pr-9"
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      value={panValue}
                      onChange={(e) => setPanValue(e.target.value.toUpperCase())}
                    />
                    {panValue.length > 0 && (
                      panCheck.isValid ? (
                        <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--success))]" />
                      ) : (
                        <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                      )
                    )}
                  </div>
                  {panCheck.isValid && panCheck.entityType && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Entity type: <span className="font-medium text-primary">{panCheck.entityType}</span>
                    </p>
                  )}
                  {!panCheck.isValid && panValue.length === 10 && (
                    <p className="text-[11px] text-destructive mt-1">Invalid PAN format</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aadhaar">Aadhaar Number</Label>
                  <Input id="aadhaar" placeholder="XXXX-XXXX-1234" maxLength={14} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" type="tel" placeholder="10-digit mobile" maxLength={10} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="altPhone">Alternate Phone</Label>
                  <Input id="altPhone" type="tel" placeholder="Optional" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@example.com" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" placeholder="Full address" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Select>
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
                  <Input id="pin" placeholder="6-digit PIN" maxLength={6} />
                </div>
              </div>
            </section>

            <Separator />

            {/* Section B: Tax & Compliance */}
            <section>
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
                  <Input id="gstRegDate" type="date" value={gstRegDate} onChange={(e) => setGstRegDate(e.target.value)} />
                  <FYHint date={gstRegDate} />
                </div>
                <div className="space-y-1.5">
                  <Label>GST Turnover Category</Label>
                  <Select>
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
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly (QRMP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tan">TAN Number</Label>
                  <Input id="tan" className="font-mono uppercase" placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ward">IT Ward / AO Code</Label>
                  <Input id="ward" placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label>ITR Type</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {itrTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Advance Tax Applicable</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Section C: Company / ROC (conditional) */}
            {isCompanyType && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                    C. Company / ROC Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="cin">CIN / LLPIN</Label>
                      <Input id="cin" className="font-mono uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>ROC Jurisdiction</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {rocJurisdictions.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="compRegDate">Registration Date</Label>
                      <Input id="compRegDate" type="date" value={compRegDate} onChange={(e) => setCompRegDate(e.target.value)} />
                      <FYHint date={compRegDate} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="authCap">Authorized Capital (₹)</Label>
                      <Input id="authCap" type="number" placeholder="₹" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>MCA Filings Applicable</Label>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {mcaFilings.map((f) => (
                          <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
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
            <section>
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                D. Services Subscribed
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {services.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer py-1">
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
            <section>
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">
                E. Fees & Billing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="annualFees">Annual Fees (₹)</Label>
                  <Input id="annualFees" type="number" placeholder="₹" />
                </div>
                <div className="space-y-1.5">
                  <Label>GST on Fees (18%)</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Frequency</Label>
                  <Select>
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
                  <Select>
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
            <div className="flex justify-end gap-3 pt-2 pb-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => onOpenChange(false)}
              >
                Save Client
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
