-- Audit trail (Fable architect review backlog item: "will be noticed in
-- demos"). A generic trigger-based log rather than app-level logging calls
-- scattered through every mutation path — this way every write to a
-- tracked table is captured regardless of which code path (UI, RPC, future
-- edge function) made it, matching this repo's existing preference for
-- DB-level enforcement (RLS, update_updated_at) over client-side promises.

create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid references auth.users(id),
  -- Denormalized so entries stay readable even if the staff row is later
  -- renamed or removed.
  changed_by_name text,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

create index audit_log_firm_changed_at_idx on public.audit_log (firm_id, changed_at desc);

alter table public.audit_log enable row level security;

-- Oversight tool — only admins can read it. Nobody has direct INSERT/
-- UPDATE/DELETE grants; only the SECURITY DEFINER trigger function below
-- writes to it (running as the function owner, so it bypasses this policy
-- the same way get_my_firm_id()/get_my_staff_role() already bypass staff's
-- RLS to read it).
create policy audit_log_select_admin
  on public.audit_log
  for select
  using (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');

create or replace function public.audit_log_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_record_id uuid;
  v_changed_by_name text;
begin
  if tg_op = 'DELETE' then
    v_firm_id := old.firm_id;
    v_record_id := old.id;
  else
    v_firm_id := new.firm_id;
    v_record_id := new.id;
  end if;

  select name into v_changed_by_name from public.staff where auth_user_id = auth.uid();

  insert into public.audit_log (firm_id, table_name, record_id, action, changed_by, changed_by_name, old_data, new_data)
  values (
    v_firm_id,
    tg_table_name,
    v_record_id,
    lower(tg_op),
    auth.uid(),
    v_changed_by_name,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- The five tables an admin would actually want to audit: client records,
-- billing (invoices/payments), work items, and who has access (staff).
create trigger clients_audit after insert or update or delete on public.clients for each row execute function public.audit_log_trigger();
create trigger invoices_audit after insert or update or delete on public.invoices for each row execute function public.audit_log_trigger();
create trigger payments_audit after insert or update or delete on public.payments for each row execute function public.audit_log_trigger();
create trigger tasks_audit after insert or update or delete on public.tasks for each row execute function public.audit_log_trigger();
create trigger staff_audit after insert or update or delete on public.staff for each row execute function public.audit_log_trigger();
