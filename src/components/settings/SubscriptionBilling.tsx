import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check, Crown, Zap, Building } from "lucide-react";
import { subscriptionPlans } from "@/data/mockSettings";
import { toast } from "sonner";

const planIcons = { Starter: Zap, Professional: Crown, Firm: Building };

export function SubscriptionBilling() {
  const [currentPlan] = useState("Starter");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Subscription & Billing</h3>
        <p className="text-sm text-muted-foreground">Manage your CA Munim subscription plan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subscriptionPlans.map((plan) => {
          const Icon = planIcons[plan.name];
          const isCurrent = plan.name === currentPlan;
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
                    <><span className="text-2xl font-bold">₹{plan.price.toLocaleString("en-IN")}</span><span className="text-sm text-muted-foreground">/month</span></>
                  )}
                </div>
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
                  disabled={isCurrent}
                  onClick={() => toast.info("Redirecting to Razorpay...")}
                >
                  {isCurrent ? "Current Plan" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Billing History</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">No billing history yet. You're on the free Starter plan.</p>
        </CardContent>
      </Card>
    </div>
  );
}
