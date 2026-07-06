-- Real Razorpay integration (replacing the RazorpayCheckoutModal demo flow —
-- ISSUES.md L1). One row per checkout attempt so we have an audit trail and
-- can safely verify a payment exactly once even if the client retries.
-- Named subscription_payments, not payments — the existing public.payments
-- table already tracks a firm's own clients' invoice payments, a completely
-- different concept from what a firm pays CA Munim for its subscription.
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  plan_id uuid not null references public.subscription_plans(id),
  cycle text not null check (cycle in ('monthly', 'annual')),
  amount integer not null, -- paise, matches Razorpay's own unit
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.subscription_payments enable row level security;

create policy "subscription_payments_firm_only"
  on public.subscription_payments
  for select
  using (firm_id = public.get_my_firm_id());

-- No insert/update policy for authenticated/anon: rows are only ever written
-- by the create-razorpay-order / verify-razorpay-payment edge functions,
-- which use the service role key and so bypass RLS entirely. Client code
-- must never be able to mark its own payment "paid".
