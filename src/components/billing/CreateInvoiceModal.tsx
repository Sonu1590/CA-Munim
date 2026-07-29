import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useClients } from "@/hooks/useClients";
import { useBilling, computeInvoiceDueDate, PAYMENT_TERMS_OPTIONS, type PaymentTerms } from "@/hooks/useBilling";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useFinancialYear } from "@/context/financialYear";
import { financialYears as availableFinancialYears } from "@/data/Tasks";
import { roundMoney } from "@/lib/indianTaxUtils";
import { formatDateIN } from "@/lib/downloads";
import { cn } from "@/lib/utils";

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => Promise<void> | void;
}

interface LineItem {
  id: string;
  description: string;
  sacCode: string;
  amount: string;
}

// M30, ISSUES.md — line items are a dynamic array, so each row's
// description/amount errors are keyed by the row's own id rather than a
// fixed field name (see fieldErrors/touched below).
const lineItemFieldKey = (id: string, field: "description" | "amount") => `li-${id}-${field}`;

export function CreateInvoiceModal({ open, onOpenChange, onCreated }: CreateInvoiceModalProps) {
  const { selectedFY } = useFinancialYear();
  const [clientId, setClientId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [fy, setFy] = useState(selectedFY);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("net_15");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [notes, setNotes] = useState("");
  const [firmState, setFirmState] = useState("");
  const { clients } = useClients();
  const { createInvoice } = useBilling();
  const [submitting, setSubmitting] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "", sacCode: "998231", amount: "" },

  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const selectedClient = clients.find((c) => c.id === clientId);
  const isSameState = selectedClient && firmState ? selectedClient.state === firmState : true;

  // M30, ISSUES.md — same per-field pattern as AddClientModal/AddTaskModal.
  const validateClientId = (): string | null => (clientId ? null : "Client is required.");

  const validateLineItem = (li: LineItem): { description?: string; amount?: string } => {
    const errs: { description?: string; amount?: string } = {};
    if (!li.description.trim()) errs.description = "Description is required.";
    if (!li.amount.trim()) errs.amount = "Amount is required.";
    else if (!(Number(li.amount) > 0)) errs.amount = "Amount must be greater than ₹0.";
    return errs;
  };

  const touchField = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  useEffect(() => {
    if (!open) return;
    setFieldErrors((prev) => {
      let changed = false;
      const next = { ...prev };

      if (touched.clientId) {
        const err = validateClientId();
        if ((err ?? null) !== (next.clientId ?? null)) {
          changed = true;
          if (err) next.clientId = err; else delete next.clientId;
        }
      }

      for (const li of lineItems) {
        const errs = validateLineItem(li);
        (["description", "amount"] as const).forEach((f) => {
          const key = lineItemFieldKey(li.id, f);
          if (!touched[key]) return;
          const err = errs[f] ?? null;
          if (err !== (next[key] ?? null)) {
            changed = true;
            if (err) next[key] = err; else delete next[key];
          }
        });
      }

      // Drop stale errors for rows the user removed.
      const liveIds = new Set(lineItems.map((li) => li.id));
      for (const key of Object.keys(next)) {
        if (!key.startsWith("li-")) continue;
        const id = key.slice(3, key.lastIndexOf("-"));
        if (!liveIds.has(id)) {
          changed = true;
          delete next[key];
        }
      }

      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, lineItems, touched]);

  const validateAll = () => {
    const next: Record<string, string> = {};
    const nextTouched: Record<string, boolean> = { ...touched, clientId: true };

    const clientErr = validateClientId();
    if (clientErr) next.clientId = clientErr;

    for (const li of lineItems) {
      const errs = validateLineItem(li);
      const descKey = lineItemFieldKey(li.id, "description");
      const amountKey = lineItemFieldKey(li.id, "amount");
      nextTouched[descKey] = true;
      nextTouched[amountKey] = true;
      if (errs.description) next[descKey] = errs.description;
      if (errs.amount) next[amountKey] = errs.amount;
    }

    setTouched(nextTouched);
    setFieldErrors(next);
    return next;
  };

  const scrollToField = (field: string) => {
    const el = document.getElementById(`invoice-${field}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement | null)?.focus?.();
  };

  useEffect(() => {
    setFy(selectedFY);
  }, [selectedFY]);

  const availableFYs = [selectedFY, ...availableFinancialYears.filter((year) => year !== selectedFY)];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("staff")
        .select("firms(state)")
        .eq("auth_user_id", user.id)
        .single()
        .then(({ data }) => {
          setFirmState((data?.firms as any)?.state ?? "");
        });
    });
  }, []);

  const subtotal = roundMoney(lineItems.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0));
  const cgst = gstEnabled && isSameState ? roundMoney(subtotal * 0.09) : 0;
  const sgst = gstEnabled && isSameState ? roundMoney(subtotal * 0.09) : 0;
  const igst = gstEnabled && !isSameState ? roundMoney(subtotal * 0.18) : 0;
  const grandTotal = roundMoney(subtotal + cgst + sgst + igst);

  // ── Generate preview invoice number matching backend format ──────────────────
  const generateInvoiceNumberPreview = (): string => {
    const fyParts = fy.split('-');
    const startYear = fyParts[0];
    const endYear = fyParts[1]?.slice(-2) || fyParts[0];
    return `INV-${startYear}${endYear}-0001`;
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now().toString(), description: "", sacCode: "998231", amount: "" }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((li) => li.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(lineItems.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  };

  const resetForm = () => {
    setClientId("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setFy(selectedFY);
    setGstEnabled(true);
    setPaymentTerms("net_15");
    setSendWhatsApp(true);
    setSendEmail(false);
    setNotes("");
    setLineItems([{ id: "1", description: "", sacCode: "998231", amount: "" }]);
    setFieldErrors({});
    setTouched({});
  };

  const handleSubmit = async () => {
    const errs = validateAll();
    const order = ["clientId", ...lineItems.flatMap((li) => [lineItemFieldKey(li.id, "description"), lineItemFieldKey(li.id, "amount")])];
    const firstInvalid = order.find((field) => errs[field]);
    if (firstInvalid) {
      scrollToField(firstInvalid);
      return;
    }

    setSubmitting(true);
    try {
      const invoiceId = await createInvoice({
        client_id: clientId,
        invoice_date: invoiceDate,
        financial_year: fy,
        line_items: lineItems.map((li) => ({
          description: li.description.trim(),
          sacCode: li.sacCode.trim(),
          amount: Number(li.amount),
        })),
        notes,
        payment_terms: paymentTerms,
        send_whatsapp: sendWhatsApp,
        gst_applicable: gstEnabled,
      }, "", firmState);

      if (!invoiceId) {
        toast.error("Could not create invoice. Please try again.");
        return;
      }

      await onCreated?.();
      toast.success("Invoice created successfully!");
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create invoice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Create Invoice</DialogTitle>
          <DialogDescription className="sr-only">Enter line items and client details to generate a new invoice.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client & basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invoice-clientId" className="text-xs">Client *</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); touchField("clientId"); }}>
                <SelectTrigger
                  id="invoice-clientId"
                  autoFocus
                  onBlur={() => touchField("clientId")}
                  className={cn(fieldErrors.clientId && "border-destructive focus-visible:ring-destructive")}
                >
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.clientId && <p className="text-[11px] text-destructive mt-1">{fieldErrors.clientId}</p>}
            </div>
            <div>
              <Label className="text-xs">Invoice Number</Label>
              <Input value={generateInvoiceNumberPreview()} disabled className="font-mono text-xs bg-muted" />
            </div>
            <div>
              <Label className="text-xs">Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Financial Year</Label>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableFYs.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <Label className="text-xs font-semibold">Line Items</Label>
            <div className="space-y-2 mt-2">
              {lineItems.map((li, idx) => {
                const descKey = lineItemFieldKey(li.id, "description");
                const amountKey = lineItemFieldKey(li.id, "amount");
                return (
                  <div key={li.id} className="flex gap-2 items-start">
                    <span className="text-xs text-muted-foreground mt-3 w-4">{idx + 1}.</span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_100px_100px] gap-2">
                      <div>
                        <Input
                          id={`invoice-${descKey}`}
                          placeholder="Description (e.g., ITR Filing — FY 2024-25)"
                          value={li.description}
                          onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                          onBlur={() => touchField(descKey)}
                          className={cn("text-sm", fieldErrors[descKey] && "border-destructive focus-visible:ring-destructive")}
                        />
                        {fieldErrors[descKey] && <p className="text-[11px] text-destructive mt-1">{fieldErrors[descKey]}</p>}
                      </div>
                      <Input
                        placeholder="SAC Code"
                        value={li.sacCode}
                        onChange={(e) => updateLineItem(li.id, "sacCode", e.target.value)}
                        className="text-sm font-mono"
                      />
                      <div>
                        <Input
                          id={`invoice-${amountKey}`}
                          placeholder="₹ Amount"
                          type="number"
                          value={li.amount}
                          onChange={(e) => updateLineItem(li.id, "amount", e.target.value)}
                          onBlur={() => touchField(amountKey)}
                          className={cn("text-sm", fieldErrors[amountKey] && "border-destructive focus-visible:ring-destructive")}
                        />
                        {fieldErrors[amountKey] && <p className="text-[11px] text-destructive mt-1">{fieldErrors[amountKey]}</p>}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-11 w-11 mt-0.5 text-muted-foreground hover:text-destructive"
                      aria-label="Remove line item"
                      onClick={() => removeLineItem(li.id)}
                      disabled={lineItems.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={addLineItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
            </Button>
          </div>

          {/* GST section */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
            <div>
              <p className="text-sm font-medium">Apply GST (18%)</p>
              {gstEnabled && selectedClient && (
                <p className="text-xs text-muted-foreground">
                  {isSameState
                    ? `Same state (${firmState}) → CGST 9% + SGST 9%`
                    : `Inter-state (${selectedClient.state}) → IGST 18%`}
                </p>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            {gstEnabled && isSameState && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST (9%)</span>
                  <span>₹{cgst.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST (9%)</span>
                  <span>₹{sgst.toLocaleString("en-IN")}</span>
                </div>
              </>
            )}
            {gstEnabled && !isSameState && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IGST (18%)</span>
                <span>₹{igst.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-heading font-bold pt-2 border-t mt-2">
              <span>Grand Total</span>
              <span className="text-primary">₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Payment terms & notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={(v) => setPaymentTerms(v as PaymentTerms)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Due {formatDateIN(computeInvoiceDueDate(invoiceDate, paymentTerms))}
              </p>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Optional note for the client" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Send options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendWhatsApp} onCheckedChange={(c) => setSendWhatsApp(!!c)} />
              Send via WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} />
              Send via Email
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
