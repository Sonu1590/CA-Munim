-- Client credential vault: DSC register + portal password vault (Fable
-- backlog item, deliberately deferred until "we're ready to do the
-- encryption properly" — see ISSUES.md). CAs juggle dozens of client GST/
-- Income-Tax/MCA portal logins and physical/cloud DSC tokens; a badly-built
-- vault here is a liability, not a feature, so this uses Supabase Vault
-- (pgsodium-backed, already installed on this project) rather than a
-- hand-rolled pgcrypto+edge-function-secret scheme — the root encryption
-- key is managed by Supabase's own infrastructure, not something this app
-- has to store, rotate, or accidentally leak (this repo has a documented
-- history of exactly that: C3). The `vault` schema is never exposed via
-- PostgREST, so the only way in or out is the two SECURITY DEFINER RPCs
-- below — mirrors the get_upload_request()-style RPC-scoping pattern this
-- repo already uses for its other sensitive/narrow access surfaces.
--
-- Admin-only end to end (no partial staff access in v1), per Fable's own
-- caution and matching the invoices/payments/staff admin gating added in
-- the RBAC migration. Every reveal is logged to audit_log (extended below
-- with a 'reveal' action) alongside the writes the generic trigger already
-- captures automatically.

create table public.client_portal_credentials (
  id uuid primary key default uuid_generate_v4(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  portal_name text not null,
  username text,
  vault_secret_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_dsc_records (
  id uuid primary key default uuid_generate_v4(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  holder_name text not null,
  dsc_serial_number text,
  issuing_authority text,
  token_type text,
  valid_from date,
  valid_until date,
  pin_vault_secret_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_portal_credentials_client_idx on public.client_portal_credentials (client_id);
create index client_dsc_records_client_idx on public.client_dsc_records (client_id);

create trigger client_portal_credentials_updated_at before update on public.client_portal_credentials for each row execute function public.update_updated_at();
create trigger client_dsc_records_updated_at before update on public.client_dsc_records for each row execute function public.update_updated_at();

-- Reuses the generic trigger from the audit trail migration — captures
-- metadata changes (portal_name/username/client_id/DSC details) the same
-- way every other tracked table already does. Never sees the plaintext
-- secret: the audited columns only ever hold a vault_secret_id reference.
create trigger client_portal_credentials_audit after insert or update or delete on public.client_portal_credentials for each row execute function public.audit_log_trigger();
create trigger client_dsc_records_audit after insert or update or delete on public.client_dsc_records for each row execute function public.audit_log_trigger();

alter table public.client_portal_credentials enable row level security;
alter table public.client_dsc_records enable row level security;

-- SELECT only — deliberately no INSERT/UPDATE/DELETE policy on either
-- table. Every write goes through the RPCs below (SECURITY DEFINER, so
-- they bypass this and enforce their own admin+firm check); a direct
-- supabase.from(...).insert()/update()/delete() from any client is denied
-- by RLS default-deny, same enforced-by-construction pattern as audit_log.
create policy client_portal_credentials_select_admin
  on public.client_portal_credentials
  for select
  using (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');

create policy client_dsc_records_select_admin
  on public.client_dsc_records
  for select
  using (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');

-- Extend audit_log to record reveal events (read access to a decrypted
-- secret), not just writes — knowing who looked at a client's portal
-- password and when matters as much as who added it.
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in ('insert', 'update', 'delete', 'reveal'));

-- ── Portal credentials ──────────────────────────────────────────────────

create or replace function public.save_client_portal_credential(
  p_id uuid,
  p_client_id uuid,
  p_portal_name text,
  p_username text,
  p_password text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_row_id uuid;
  v_vault_secret_id uuid;
  v_secret_name text;
begin
  if public.get_my_staff_role() != 'admin' then
    raise exception 'Only firm admins can manage client credentials';
  end if;

  v_firm_id := public.get_my_firm_id();

  if not exists (select 1 from public.clients where id = p_client_id and firm_id = v_firm_id) then
    raise exception 'Client not found or access denied';
  end if;

  v_secret_name := 'client_portal_credential:' || gen_random_uuid()::text;

  if p_id is null then
    if p_password is not null then
      v_vault_secret_id := vault.create_secret(p_password, v_secret_name, 'Client portal credential');
    end if;

    insert into public.client_portal_credentials (firm_id, client_id, portal_name, username, vault_secret_id, notes)
    values (v_firm_id, p_client_id, p_portal_name, p_username, v_vault_secret_id, p_notes)
    returning id into v_row_id;
  else
    select cpc.vault_secret_id into v_vault_secret_id
    from public.client_portal_credentials cpc
    where cpc.id = p_id and cpc.firm_id = v_firm_id;

    if not found then
      raise exception 'Credential not found or access denied';
    end if;

    if p_password is not null then
      if v_vault_secret_id is null then
        v_vault_secret_id := vault.create_secret(p_password, v_secret_name, 'Client portal credential');
      else
        perform vault.update_secret(v_vault_secret_id, p_password);
      end if;
    end if;

    update public.client_portal_credentials
    set client_id = p_client_id,
        portal_name = p_portal_name,
        username = p_username,
        vault_secret_id = v_vault_secret_id,
        notes = p_notes
    where id = p_id and firm_id = v_firm_id;

    v_row_id := p_id;
  end if;

  return v_row_id;
end;
$$;

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

create or replace function public.delete_client_portal_credential(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_vault_secret_id uuid;
begin
  if public.get_my_staff_role() != 'admin' then
    raise exception 'Only firm admins can manage client credentials';
  end if;

  v_firm_id := public.get_my_firm_id();

  select cpc.vault_secret_id into v_vault_secret_id
  from public.client_portal_credentials cpc
  where cpc.id = p_id and cpc.firm_id = v_firm_id;

  if not found then
    raise exception 'Credential not found or access denied';
  end if;

  delete from public.client_portal_credentials where id = p_id and firm_id = v_firm_id;

  if v_vault_secret_id is not null then
    delete from vault.secrets where id = v_vault_secret_id;
  end if;
end;
$$;

-- ── DSC records ─────────────────────────────────────────────────────────

create or replace function public.save_client_dsc_record(
  p_id uuid,
  p_client_id uuid,
  p_holder_name text,
  p_dsc_serial_number text,
  p_issuing_authority text,
  p_token_type text,
  p_valid_from date,
  p_valid_until date,
  p_pin text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_row_id uuid;
  v_pin_vault_secret_id uuid;
  v_secret_name text;
begin
  if public.get_my_staff_role() != 'admin' then
    raise exception 'Only firm admins can manage DSC records';
  end if;

  v_firm_id := public.get_my_firm_id();

  if not exists (select 1 from public.clients where id = p_client_id and firm_id = v_firm_id) then
    raise exception 'Client not found or access denied';
  end if;

  v_secret_name := 'client_dsc_pin:' || gen_random_uuid()::text;

  if p_id is null then
    if p_pin is not null then
      v_pin_vault_secret_id := vault.create_secret(p_pin, v_secret_name, 'Client DSC token PIN');
    end if;

    insert into public.client_dsc_records
      (firm_id, client_id, holder_name, dsc_serial_number, issuing_authority, token_type, valid_from, valid_until, pin_vault_secret_id, notes)
    values
      (v_firm_id, p_client_id, p_holder_name, p_dsc_serial_number, p_issuing_authority, p_token_type, p_valid_from, p_valid_until, v_pin_vault_secret_id, p_notes)
    returning id into v_row_id;
  else
    select cdr.pin_vault_secret_id into v_pin_vault_secret_id
    from public.client_dsc_records cdr
    where cdr.id = p_id and cdr.firm_id = v_firm_id;

    if not found then
      raise exception 'DSC record not found or access denied';
    end if;

    if p_pin is not null then
      if v_pin_vault_secret_id is null then
        v_pin_vault_secret_id := vault.create_secret(p_pin, v_secret_name, 'Client DSC token PIN');
      else
        perform vault.update_secret(v_pin_vault_secret_id, p_pin);
      end if;
    end if;

    update public.client_dsc_records
    set client_id = p_client_id,
        holder_name = p_holder_name,
        dsc_serial_number = p_dsc_serial_number,
        issuing_authority = p_issuing_authority,
        token_type = p_token_type,
        valid_from = p_valid_from,
        valid_until = p_valid_until,
        pin_vault_secret_id = v_pin_vault_secret_id,
        notes = p_notes
    where id = p_id and firm_id = v_firm_id;

    v_row_id := p_id;
  end if;

  return v_row_id;
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

create or replace function public.delete_client_dsc_record(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_pin_vault_secret_id uuid;
begin
  if public.get_my_staff_role() != 'admin' then
    raise exception 'Only firm admins can manage DSC records';
  end if;

  v_firm_id := public.get_my_firm_id();

  select cdr.pin_vault_secret_id into v_pin_vault_secret_id
  from public.client_dsc_records cdr
  where cdr.id = p_id and cdr.firm_id = v_firm_id;

  if not found then
    raise exception 'DSC record not found or access denied';
  end if;

  delete from public.client_dsc_records where id = p_id and firm_id = v_firm_id;

  if v_pin_vault_secret_id is not null then
    delete from vault.secrets where id = v_pin_vault_secret_id;
  end if;
end;
$$;

grant execute on function public.save_client_portal_credential(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.reveal_client_portal_credential(uuid) to authenticated;
grant execute on function public.delete_client_portal_credential(uuid) to authenticated;
grant execute on function public.save_client_dsc_record(uuid, uuid, text, text, text, text, date, date, text, text) to authenticated;
grant execute on function public.reveal_client_dsc_pin(uuid) to authenticated;
grant execute on function public.delete_client_dsc_record(uuid) to authenticated;
