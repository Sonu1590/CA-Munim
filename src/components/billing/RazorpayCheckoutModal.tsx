import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, Info, Smartphone, Building, IndianRupee } from "lucide-react";
import { SubscriptionPlan } from "@/data/Settings";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan | null;
  cycle: "monthly" | "annual";
}

type Step = "summary" | "method" | "processing" | "success";
type PayMethod = "upi" | "netbanking";

export function RazorpayCheckoutModal({ open, onOpenChange, plan, cycle }: Props) {
  const [step, setStep] = useState<Step>("summary");
  const [method, setMethod] = useState<PayMethod>("upi");
  const [upi, setUpi] = useState("");

  useEffect(() => {
    if (open) setStep("summary");
  }, [open]);

  if (!plan) return null;

  const months = cycle === "annual" ? 10 : 1; // 2 months free annually
  const subtotal = plan.price * months;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const startPayment = () => {
    if (method === "upi" && !/^[\w.\-]+@[\w]+$/.test(upi)) {
      toast.error("Enter a valid UPI ID (e.g. name@bank)");
      return;
    }
    setStep("processing");
    setTimeout(() => setStep("success"), 1800);
  };

  const finish = () => {
    onOpenChange(false);
    toast.success(`Subscription activated: ${plan.name} (${cycle})`, {
      description: `Razorpay ref: rzp_${Math.random().toString(36).slice(2, 10)}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <div className="h-7 px-2 rounded bg-[#072654] text-white text-xs font-bold flex items-center">Razorpay</div>
            Demo Checkout
          </DialogTitle>
        </DialogHeader>

        {step === "summary" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="text-sm font-semibold">{plan.name} ({cycle})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal {cycle === "annual" && <span className="text-[10px] text-green-600">(2 months free)</span>}</span>
                <span className="text-sm font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">GST @ 18%</span>
                <span className="text-sm font-medium">₹{gst.toLocaleString("en-IN")}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex items-center justify-between">
                <span className="font-heading font-semibold">Total</span>
                <span className="font-heading font-bold text-lg flex items-center"><IndianRupee className="h-4 w-4" />{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Demo mode — no real payment gateway is connected yet · Auto-renews {cycle === "annual" ? "yearly" : "monthly"} · Cancel anytime
            </div>
            <Button onClick={() => setStep("method")} className="w-full h-11 bg-primary">Continue to Payment</Button>
          </div>
        )}

        {step === "method" && (
          <div className="space-y-4">
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as PayMethod)} className="space-y-2">
              {[
                { id: "upi", label: "UPI", icon: Smartphone, hint: "GPay, PhonePe, Paytm" },
                { id: "netbanking", label: "Net Banking", icon: Building, hint: "All major banks" },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <label key={m.id} htmlFor={m.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${method === m.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <RadioGroupItem value={m.id} id={m.id} />
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground">{m.hint}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>

            {method === "upi" && (
              <div className="space-y-2">
                <Label>UPI ID</Label>
                <Input placeholder="yourname@okhdfcbank" value={upi} onChange={(e) => setUpi(e.target.value)} />
              </div>
            )}
            {method === "netbanking" && (
              <p className="text-xs text-muted-foreground">You'll be redirected to your bank's secure login page.</p>
            )}

            <Button onClick={startPayment} className="w-full h-11 bg-primary">
              Pay ₹{total.toLocaleString("en-IN")}
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="font-heading font-semibold">Processing payment…</p>
            <p className="text-xs text-muted-foreground">Do not close or refresh this window</p>
          </div>
        )}

        {step === "success" && (
          <div className="py-6 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-heading font-bold text-lg">Payment Successful</p>
              <p className="text-sm text-muted-foreground mt-1">
                {plan.name} plan activated · ₹{total.toLocaleString("en-IN")}
              </p>
            </div>
            <Button onClick={finish} className="w-full bg-primary">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
