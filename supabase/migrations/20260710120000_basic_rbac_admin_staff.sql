-- Basic two-tier RBAC (admin/staff), backlog item flagged by the Fable
-- architect review: "acceptable for solo practitioners at launch, blocking
-- for any firm with 3+ staff." Today every signed-in staff member — via a
-- single blanket `for all using (firm_id = get_my_firm_id())` policy — can
-- read/write/delete every other firm's... no, every OWN firm's invoices,
-- payments, staff records (including changing anyone's role, i.e.
-- self-promoting to admin), and the firm profile. StaffManagement.tsx
-- already displays an "Admin vs Staff" permissions card describing exactly
-- this split, but nothing enforced it — this migration makes it real.

-- 1. staff.role was free text (default 'staff') but StaffManagement.tsx's
--    Add Staff dialog was writing job-title-like strings ("Senior CA",
--    "Article Clerk", "Admin Staff") into it — conflating access role with
--    job title. Separate them: job_title is descriptive only, role becomes
--    a real two-value access-control column. Existing non-admin free-text
--    values (job titles) move to job_title; role resets to 'staff' for them.
alter table public.staff add column if not exists job_title text;

update public.staff
set job_title = role, role = 'staff'
where role not in ('admin', 'staff');

alter table public.staff
  add constraint staff_role_check check (role in ('admin', 'staff'));

-- 2. Mirrors get_my_firm_id()'s exact pattern (schema-qualified,
--    search_path pinned per the M5 security-advisor fix).
create or replace function public.get_my_staff_role()
returns text
language sql
stable security definer
set search_path = ''
as $$
  select role from public.staff
  where auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_staff_role() to authenticated;

-- 3. Billing (invoices/payments): admin-only for every operation, matching
--    StaffManagement's existing "Staff... cannot access billing" promise.
drop policy if exists invoices_all on public.invoices;
create policy invoices_admin_all
  on public.invoices
  for all
  using (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');

drop policy if exists payments_all on public.payments;
create policy payments_admin_all
  on public.payments
  for all
  using (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');

-- 4. Staff records: everyone in the firm can still read colleague names
--    (needed for "assigned to" pickers etc.), but only admins can add,
--    edit, or remove staff — closes the self-promotion hole where any
--    staff member could currently UPDATE their own row's role to 'admin'.
drop policy if exists staff_all on public.staff;
create policy staff_select
  on public.staff
  for select
  using (firm_id = public.get_my_firm_id());
create policy staff_insert_admin
  on public.staff
  for insert
  with check (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');
create policy staff_update_admin
  on public.staff
  for update
  using (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');
create policy staff_delete_admin
  on public.staff
  for delete
  using (firm_id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');

-- 5. Firm profile: reading stays open to all staff, editing (name, GST
--    details, invoice numbering, etc.) is admin-only.
drop policy if exists firms_update on public.firms;
create policy firms_update_admin
  on public.firms
  for update
  using (id = public.get_my_firm_id() and public.get_my_staff_role() = 'admin');
