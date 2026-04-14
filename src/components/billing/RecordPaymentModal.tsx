import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Invoice, PaymentMode } from "@/data/mockBilling";
import { toast } from "@/components/ui/sonner";

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

const paymentModes: PaymentMode[] = ["UPI", "NEFT", "RTGS", "IMPS", "Cash", "Cheque", "Demand Draft"];

export function RecordPaymentModal({ open, onOpenChange, invoice }: RecordPaymentModalProps) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  if (!invoice) return null;

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!mode) return toast.error("Select a payment mode");
    if (amt > invoice.amountDue) return toast.error(`Amount cannot exceed ₹${invoice.amountDue.toLocaleString("en-IN")}`);

    const isFullPayment = amt >= invoice.amountDue;
    toast.success(
      isFullPayment
        ? `Full payment of ₹${amt.toLocaleString("en-IN")} recorded — Invoice marked as Paid`
        : `Partial payment of ₹${amt.toLocaleString("en-IN")} recorded — Remaining: ₹${(invoice.amountDue - amt).toLocaleString("en-IN")}`
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Record Payment</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 mb-2">
          <p className="text-sm font-medium">{invoice.clientName}</p>
          <p className="text-xs text-muted-foreground font-mono">{invoice.invoiceNumber}</p>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-muted-foreground">Invoice Total</span>
            <span className="font-semibold">₹{invoice.grandTotal.toLocaleString("en-IN")}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="text-green-600">₹{invoice.amountPaid.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-1 border-t mt-1">
            <span>Balance Due</span>
            <span className="text-destructive">₹{invoice.amountDue.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Amount Received (₹)</Label>
            <Input
              type="number"
              placeholder={`Max: ₹${invoice.amountDue.toLocaleString("en-IN")}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Payment Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
              <SelectContent>
                {paymentModes.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">UTR / Reference / Cheque Number</Label>
            <Input
              placeholder="Enter reference number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              placeholder="Any remarks"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={handleSubmit}>
              Record Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
