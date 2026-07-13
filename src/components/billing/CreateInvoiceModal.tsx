import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const selectedClient = clients.find((c) => c.id === clientId);
  const isSameState = selectedClient && firmState ? selectedClient.state === firmState : true;

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
  };

  const handleSubmit = async () => {
    if (!clientId) return toast.error("Please select a client");
    if (lineItems.some((li) => !li.description || !li.amount)) return toast.error("Please fill all line items");

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
        </DialogHeader>

        <div className="space-y-4">
          {/* Client & basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {lineItems.map((li, idx) => (
                <div key={li.id} className="flex gap-2 items-start">
                  <span className="text-xs text-muted-foreground mt-3 w-4">{idx + 1}.</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_100px_100px] gap-2">
                    <Input
                      placeholder="Description (e.g., ITR Filing — FY 2024-25)"
                      value={li.description}
                      onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="SAC Code"
                      value={li.sacCode}
                      onChange={(e) => updateLineItem(li.id, "sacCode", e.target.value)}
                      className="text-sm font-mono"
                    />
                    <Input
                      placeholder="₹ Amount"
                      type="number"
                      value={li.amount}
                      onChange={(e) => updateLineItem(li.id, "amount", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 mt-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLineItem(li.id)}
                    disabled={lineItems.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
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
