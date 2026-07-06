-- Updated pricing (user-directed, 2026-07-06) and a new "Founding Member"
-- tier: a capped, one-time pre-sell offer (first 50 firms) used to validate
-- pricing and generate early testimonials, priced permanently below
-- Professional and never repriced for firms that claim it.

-- Starter was live at price_monthly 599 / price_annual 5990 — actually
-- charging money despite being intended as the free adoption/referral
-- tier (the frontend mock always assumed price 0). Fixing the data, not
-- just the display.
update public.subscription_plans
  set price_monthly = 0, price_annual = 0, client_limit = 25, staff_limit = 1,
      features = '["25 clients", "1 user", "Manual WhatsApp reminders only"]'::jsonb
  where name = 'Starter';

update public.subscription_plans
  set price_monthly = 417, price_annual = 4999, client_limit = 150, staff_limit = 3,
      features = '["150 clients", "3 users", "Automated WhatsApp reminders (~500 utility messages/month, then top-up)", "All reports"]'::jsonb
  where name = 'Professional';

-- client_limit 0 was being read by the frontend as "0 clients" rather than
-- unlimited — the UI's unlimited check is `clientLimit >= 999`, so use that
-- sentinel instead of 0.
update public.subscription_plans
  set price_monthly = 833, price_annual = 9999, client_limit = 999, staff_limit = 10,
      features = '["Unlimited clients", "10 users", "White-label invoices", "Priority support"]'::jsonb
  where name = 'Firm';

insert into public.subscription_plans (name, price_monthly, price_annual, client_limit, staff_limit, features, is_active)
values (
  'Founding Member', 250, 2999, 150, 3,
  '["150 clients", "3 users", "Automated WhatsApp reminders", "Price locked for life", "First 50 firms only"]'::jsonb,
  true
);

-- Lets the pricing page show "N of 50 claimed" without exposing individual
-- firms' payment rows — subscription_payments is otherwise firm-scoped RLS,
-- and remaining-slot counts are the only thing that needs to be public.
-- Counts lifetime paid signups for this plan, not currently-active
-- subscribers: once 50 have ever purchased it, the offer is closed for
-- good, even if some later downgrade.
create or replace function public.get_founding_member_slots_remaining()
returns integer
language sql
stable security definer
set search_path = ''
as $$
  select greatest(0, 50 - (
    select count(distinct sp.firm_id)
    from public.subscription_payments sp
    join public.subscription_plans plan on plan.id = sp.plan_id
    where plan.name = 'Founding Member' and sp.status = 'paid'
  ));
$$;

grant execute on function public.get_founding_member_slots_remaining() to authenticated;
