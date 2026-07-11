-- M6 (ISSUES.md): "firms has both the older auth.uid() = id policies and
-- the newer id = get_my_firm_id() policies simultaneously... consolidate
-- to a single scheme." Re-checked live: this is already resolved -- the
-- old auth.uid()-keyed policies ("Allow authenticated users to
-- insert/select/update own firm") were dropped by the H1/H2 fix in
-- 20260702140000_ensure_my_firm_rpc.sql, which moved firm creation to the
-- ensure_my_firm_rpc() SECURITY DEFINER RPC. Only two policies remain live,
-- both scoped by get_my_firm_id(): firms_select (read) and
-- firms_update_admin (admin-only write, added by
-- 20260710120000_basic_rbac_admin_staff.sql). No duplication, no OR'd
-- widening. There is intentionally no INSERT/DELETE policy -- firm
-- creation only happens through ensure_my_firm_rpc().
--
-- The one real gap: firms_select itself was never defined in any tracked
-- migration (it predates this repo's migration-file convention, part of
-- the original scaffold), so rebuilding the schema from migrations alone
-- would silently omit it. This migration is a no-op against the live DB
-- (the policy already exists with identical logic) but closes that trail
-- gap so migrations remain the authoritative schema history.
drop policy if exists firms_select on public.firms;
create policy firms_select
  on public.firms
  for select
  using (id = public.get_my_firm_id());
