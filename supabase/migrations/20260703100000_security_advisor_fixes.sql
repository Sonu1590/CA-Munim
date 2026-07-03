-- Resolve Supabase security-advisor warnings (ISSUES.md M5).

-- 1. subscription_plans had RLS enabled with no policy at all, meaning
--    literally nobody could read it (deny-by-default). It holds non-sensitive
--    pricing/plan data — same trust level as compliance_bulletins /
--    compliance_rules, which already use this exact "signed-in" policy.
create policy "subscription_plans_read"
  on public.subscription_plans
  for select
  using (auth.role() = 'authenticated');

-- 2. Pin search_path on functions that had it mutable (prevents search-path
--    hijacking, where an earlier-resolving schema could shadow an intended
--    unqualified table/function reference).
--    get_my_firm_id referenced `staff` unqualified — fully qualify it so it
--    still resolves correctly once search_path is empty.
create or replace function public.get_my_firm_id()
returns uuid
language sql
stable security definer
set search_path = ''
as $$
  select firm_id from public.staff
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- handle_new_user and update_updated_at already fully qualify every
-- reference (or reference none), so pinning search_path needs no body
-- change — just the setting.
alter function public.handle_new_user() set search_path = '';
alter function public.update_updated_at() set search_path = '';

-- 3. handle_new_user is a trigger-only function (fired internally by Supabase
--    Auth's own insert into auth.users) and was never meant to be a directly
--    callable RPC endpoint. Revoking EXECUTE from anon/authenticated closes
--    that direct-call surface without affecting trigger firing, since the
--    trigger runs under the function owner's privileges (SECURITY DEFINER),
--    not the calling role's.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
