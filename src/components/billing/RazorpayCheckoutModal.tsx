import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Info, IndianRupee } from "lucide-react";
import { SubscriptionPlan } from "@/data/Settings";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan | null;
  cycle: "monthly" | "annual";
}

type Step = "summary" | "processing" | "success";

// Razorpay's own hosted Checkout — card/UPI/netbanking details are entered
// inside Razorpay's iframe, never touching our frontend or backend, so this
// stays out of PCI-DSS scope entirely.
function loadRazorpayScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });
}

export function RazorpayCheckoutModal({ open, onOpenChange, plan, cycle }: Props) {
  const [step, setStep] = useState<Step>("summary");
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    if (open) setStep("summary");
  }, [open]);

  if (!plan) return null;

  const months = cycle === "annual" ? 10 : 1; // 2 months free annually
  const subtotal = plan.price * months;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const startPayment = async () => {
    if (!plan.id) {
      toast.error("Plan data unavailable — please reload and try again.");
      return;
    }

    setStep("processing");
    try {
      await loadRazorpayScript();

      const { data: order, error: orderError } = await supabase.functions.invoke("create-razorpay-order", {
        body: { planId: plan.id, cycle },
      });
      if (orderError || !order) throw new Error(orderError?.message ?? "Unable to create order.");
      if (order.error) throw new Error(order.error);

      const razorpay = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "CA Munim",
        description: `${plan.name} plan (${cycle})`,
        theme: { color: "#1e3a5f" },
        handler: async (response: any) => {
          try {
            const { data: verified, error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment", {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (verifyError || !verified?.success) throw new Error(verifyError?.message ?? "Payment verification failed.");
            setPaidAmount(order.amount / 100);
            setStep("success");
          } catch (err: any) {
            toast.error(err?.message ?? "Payment could not be verified. Contact support if you were charged.");
            setStep("summary");
          }
        },
        modal: {
          ondismiss: () => setStep("summary"),
        },
      });
      razorpay.open();
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to start checkout.");
      setStep("summary");
    }
  };

  const finish = () => {
    onOpenChange(false);
    toast.success(`Subscription activated: ${plan.name} (${cycle})`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <div className="h-7 px-2 rounded bg-[#072654] text-white text-xs font-bold flex items-center">Razorpay</div>
            Checkout
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
              Auto-renews {cycle === "annual" ? "yearly" : "monthly"} · Cancel anytime
            </div>
            <Button onClick={startPayment} className="w-full h-11 bg-primary">Pay ₹{total.toLocaleString("en-IN")}</Button>
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
                {plan.name} plan activated · ₹{paidAmount.toLocaleString("en-IN")}
              </p>
            </div>
            <Button onClick={finish} className="w-full bg-primary">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
