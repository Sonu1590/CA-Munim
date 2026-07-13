-- M10 (ISSUES.md): the credential vault's reveal RPCs were deliberately
-- shipped without rate-limiting or re-authentication — "revisit if the
-- firm grows past a handful of staff... or if reveal abuse is ever
-- observed." Adding the rate-limit half here (server-side, since anything
-- client-side is trivially bypassable by calling the RPC directly). The
-- re-auth half is a client-side password-confirmation step (see
-- ClientCredentialsPanel.tsx) — Supabase Auth's signInWithPassword() is
-- itself the server-side check there, so no additional RPC-side state is
-- needed for that half.
--
-- Reuses audit_log rather than a new table: every reveal already writes a
-- 'reveal' row there (added in the original vault migration), so counting
-- an admin's own recent reveals is just a query, not new bookkeeping.
-- Threshold (20 per 5 minutes) is generous enough for legitimate bulk work
-- (e.g. an admin checking several clients' GST portal logins in a row)
-- while still stopping a runaway/scripted reveal loop.
create or replace function public.check_reveal_rate_limit()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_reveals int;
begin
  select count(*) into v_recent_reveals
  from public.audit_log
  where changed_by = auth.uid()
    and action = 'reveal'
    and changed_at > now() - interval '5 minutes';

  if v_recent_reveals >= 20 then
    raise exception 'Too many credential reveals in a short time (limit: 20 per 5 minutes). Please wait a few minutes and try again.';
  end if;
end;
$$;

grant execute on function public.check_reveal_rate_limit() to authenticated;

create or replace function public.reveal_client_portal_credential(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_vault_secret_id uuid;
  v_portal_name text;
  v_username text;
  v_secret text;
  v_changed_by_name text;
begin
  if public.get_my_staff_role() != 'admin' then
    raise exception 'Only firm admins can view client credentials';
  end if;

  perform public.check_reveal_rate_limit();

  v_firm_id := public.get_my_firm_id();

  select cpc.vault_secret_id, cpc.portal_name, cpc.username
  into v_vault_secret_id, v_portal_name, v_username
  from public.client_portal_credentials cpc
  where cpc.id = p_id and cpc.firm_id = v_firm_id;

  if not found then
    raise exception 'Credential not found or access denied';
  end if;

  if v_vault_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_vault_secret_id;

  select name into v_changed_by_name from public.staff where auth_user_id = auth.uid();

  insert into public.audit_log (firm_id, table_name, record_id, action, changed_by, changed_by_name, new_data)
  values (v_firm_id, 'client_portal_credentials', p_id, 'reveal', auth.uid(), v_changed_by_name,
          jsonb_build_object('portal_name', v_portal_name, 'username', v_username));

  return v_secret;
end;
$$;

create or replace function public.reveal_client_dsc_pin(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_pin_vault_secret_id uuid;
  v_holder_name text;
  v_secret text;
  v_changed_by_name text;
begin
  if public.get_my_staff_role() != 'admin' then
    raise exception 'Only firm admins can view DSC PINs';
  end if;

  perform public.check_reveal_rate_limit();

  v_firm_id := public.get_my_firm_id();

  select cdr.pin_vault_secret_id, cdr.holder_name
  into v_pin_vault_secret_id, v_holder_name
  from public.client_dsc_records cdr
  where cdr.id = p_id and cdr.firm_id = v_firm_id;

  if not found then
    raise exception 'DSC record not found or access denied';
  end if;

  if v_pin_vault_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_pin_vault_secret_id;

  select name into v_changed_by_name from public.staff where auth_user_id = auth.uid();

  insert into public.audit_log (firm_id, table_name, record_id, action, changed_by, changed_by_name, new_data)
  values (v_firm_id, 'client_dsc_records', p_id, 'reveal', auth.uid(), v_changed_by_name,
          jsonb_build_object('holder_name', v_holder_name));

  return v_secret;
end;
$$;
