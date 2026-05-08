import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Check, Crown, Zap, Building, Download, Loader2 } from "lucide-react";
import { fetchSubscriptionPlansFromSupabase, type SubscriptionPlan } from "@/data/Settings";
import { RazorpayCheckoutModal } from "@/components/billing/RazorpayCheckoutModal";

const planIcons = { Starter: Zap, Professional: Crown, Firm: Building };

const billingHistory = [
  { id: "rzp_QkA7m2", date: "2025-04-01", plan: "Starter", amount: 0, status: "Free" },
];

export function SubscriptionBilling() {
  const [currentPlan, setCurrentPlan] = useState("Starter");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSubscriptionPlansFromSupabase();
        setPlans(data);
      } catch (err: any) {
        setError(err.message ?? "Unable to load subscription plans");
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Subscription & Billing</h3>
          <p className="text-sm text-muted-foreground">Manage your CA Munim subscription via Razorpay</p>
        </div>
        <Tabs value={cycle} onValueChange={(v) => setCycle(v as any)}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Annual <Badge variant="secondary" className="ml-1.5 text-[9px]">2 months free</Badge></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" />Loading plans...</div>
      ) : error ? (
        <div className="p-8 text-center text-destructive">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const Icon = planIcons[plan.name];
            const isCurrent = plan.name === currentPlan;
            const displayPrice = cycle === "annual" ? plan.price * 10 : plan.price;
            return (
              <Card key={plan.name} className={isCurrent ? "border-primary ring-2 ring-primary/20" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />{plan.name}
                    </CardTitle>
                    {isCurrent && <Badge className="bg-primary text-primary-foreground">Current</Badge>}
                  </div>
                  <div className="mt-2">
                    {plan.price === 0 ? (
                      <span className="text-2xl font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">₹{displayPrice.toLocaleString("en-IN")}</span>
                        <span className="text-sm text-muted-foreground">/{cycle === "annual" ? "year" : "month"}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.clientLimit >= 999 ? "Unlimited clients" : `Up to ${plan.clientLimit} clients`} · {plan.staffLimit} {plan.staffLimit === 1 ? "user" : "users"}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-4"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || plan.price === 0}
                    onClick={() => setCheckoutPlan(plan)}
                  >
                    {isCurrent ? "Current Plan" : plan.price === 0 ? "Free Plan" : `Upgrade via Razorpay`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Billing History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {billingHistory.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{b.plan} · {new Date(b.date).toLocaleDateString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground font-mono">{b.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{b.amount === 0 ? "Free" : `₹${b.amount.toLocaleString("en-IN")}`}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <RazorpayCheckoutModal
        open={!!checkoutPlan}
        onOpenChange={(o) => !o && setCheckoutPlan(null)}
        plan={checkoutPlan}
        cycle={cycle}
      />
    </div>
  );
}
