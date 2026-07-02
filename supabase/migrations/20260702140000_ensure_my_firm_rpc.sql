-- Fix H1/H2 from ISSUES.md: conflicting firm-creation paths and a
-- self-heal path that was silently blocked by RLS.
--
-- Context: the on_auth_user_created trigger (handle_new_user) is the single
-- working signup path — it creates a firm with an auto-generated UUID and
-- links it via staff.auth_user_id. It swallows its own errors (`exception
-- when others`) so user creation never fails, but that means a user can end
-- up authenticated with no firm/staff row if something inside it fails.
--
-- App.tsx's bootstrapMissingRecords exists to repair that case, but it does
-- a raw client-side `firms.insert()` with an auto-generated id, which the
-- legacy policy "Allow authenticated users to insert own firm" rejects
-- (WITH CHECK (auth.uid() = id) — never true for an auto-generated firm id).
-- The error is swallowed, so affected users see no error and stay stuck.
--
-- Fix: a SECURITY DEFINER RPC that mirrors handle_new_user's logic, callable
-- by an authenticated user only for themselves (uses auth.uid() internally,
-- never a client-supplied id), idempotent, and immune to the RLS mismatch.
-- Then drop the obsolete `auth.uid() = id` policies — they assumed a data
-- model (firm.id == user.id) the app no longer uses anywhere, they're
-- redundant with the get_my_firm_id()-based policies, and once client code
-- stops doing raw firms inserts, they have no legitimate caller left.

create or replace function public.ensure_my_firm()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_email text;
  v_metadata jsonb;
  v_ca_name text;
  v_firm_name text;
  v_icai text;
  v_practice_type text;
begin
  -- Already linked — idempotent, no-op.
  select firm_id into v_firm_id
  from public.staff
  where auth_user_id = auth.uid()
  limit 1;

  if v_firm_id is not null then
    return v_firm_id;
  end if;

  select email, raw_user_meta_data into v_email, v_metadata
  from auth.users
  where id = auth.uid();

  if v_email is null then
    raise exception 'No authenticated user';
  end if;

  v_ca_name := coalesce(
    nullif(trim(v_metadata->>'ca_name'), ''),
    nullif(trim(v_metadata->>'full_name'), ''),
    split_part(v_email, '@', 1)
  );
  v_firm_name := nullif(trim(v_metadata->>'firm_name'), '');
  v_icai := nullif(trim(v_metadata->>'icai_number'), '');
  v_practice_type := case when v_metadata->>'practice_type' = 'solo' then 'solo' else 'firm' end;

  -- Reuse an existing firm with this email if handle_new_user already made
  -- one (matches its own dedup-by-email behavior).
  select id into v_firm_id from public.firms where email = v_email limit 1;

  if v_firm_id is null then
    insert into public.firms (name, ca_name, icai_number, email, practice_type, onboarding_complete)
    values (coalesce(v_firm_name, v_ca_name), v_ca_name, v_icai, v_email, v_practice_type, false)
    returning id into v_firm_id;
  end if;

  insert into public.staff (firm_id, name, email, auth_user_id, role, active)
  values (v_firm_id, v_ca_name, v_email, auth.uid(), 'admin', true)
  on conflict (auth_user_id) do update set firm_id = excluded.firm_id;

  return v_firm_id;
end;
$$;

grant execute on function public.ensure_my_firm() to authenticated;

-- Drop the obsolete policies keyed on the wrong (firm.id == user.id) model.
drop policy if exists "Allow authenticated users to insert own firm" on public.firms;
drop policy if exists "Allow authenticated users to select own firm" on public.firms;
drop policy if exists "Allow authenticated users to update own firm" on public.firms;
