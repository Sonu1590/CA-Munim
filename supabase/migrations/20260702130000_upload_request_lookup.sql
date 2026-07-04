-- Fix cross-tenant data leak on document_requests (ISSUES.md C2).
--
-- The previous policy `doc_requests_public_token` granted SELECT to the public
-- (anon) role with the predicate `(upload_token IS NOT NULL)`. That is not
-- scoped to a specific token, so anyone with the anon key could read EVERY
-- firm's document requests (client_id, document_type, due_date, upload_token).
--
-- Fix: expose a single-row, token-scoped lookup via a SECURITY DEFINER RPC and
-- remove the broad public SELECT policy. Anonymous portal visitors no longer
-- have any direct SELECT access to the table; they can only resolve the one
-- request that matches the token they were given.

-- 1. Token-scoped lookup used by the public /upload/:token portal.
--    Joins clients server-side so the portal can show the client name without
--    granting anon any access to the clients table.
create or replace function public.get_upload_request(p_token text)
returns table (
  document_type text,
  custom_label text,
  due_date date,
  client_id uuid,
  client_name text
)
language sql
security definer
set search_path = ''
as $$
  select dr.document_type, dr.custom_label, dr.due_date, dr.client_id, c.name
  from public.document_requests dr
  left join public.clients c on c.id = dr.client_id
  where dr.upload_token = p_token
    and dr.status = 'pending'
  limit 1;
$$;

grant execute on function public.get_upload_request(text) to anon, authenticated;

-- 2. Remove the over-broad public SELECT policy. Firm access is still covered
--    by `doc_requests_firm` (ALL where firm_id = get_my_firm_id()), and the
--    upload write path uses the SECURITY DEFINER record_client_upload RPC, so
--    nothing else depends on this policy.
drop policy if exists "doc_requests_public_token" on public.document_requests;
