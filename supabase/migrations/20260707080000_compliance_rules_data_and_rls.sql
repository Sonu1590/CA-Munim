-- compliance_rules already existed with a good shape (due_date_rule/
-- late_fee_rule jsonb, effective_from/effective_to) but nothing read it —
-- three separate hardcoded sources of truth in the frontend (dueDateRules,
-- BulkTaskGenerator.calculateDueDate, penaltyRules.ts) were already out of
-- sync with each other (architect review, 2026-07-06). This migration:
-- 1. Adds the missing read policy (RLS was enabled with zero policies —
--    same silent deny-by-default bug as subscription_plans, M5).
-- 2. Retires one leftover test row (notification_ref 'NOTIF-MOCK-001',
--    states ["MH","GJ"], generic filing_type "GST") that doesn't match the
--    real schema's conventions.
-- 3. Adds min_fy_start_year/max_fy_start_year to due_date_rule so a single
--    filing_type can carry both an old and a new rule and the interpreter
--    picks the right one per financial year — this is what actually gives
--    us "GSTR-4 due date changed in FY 2024-25" without a code deploy.
-- 4. Inserts the filing types that had no row at all (GSTR-4, GSTR-9C,
--    CMP-08, Tax Audit/Form 3CD, DIR-3 KYC).

create policy "compliance_rules_read"
  on public.compliance_rules
  for select
  using (auth.role() = 'authenticated');

update public.compliance_rules
  set active = false
  where notification_ref = 'NOTIF-MOCK-001';

-- GSTR-4: 30 Apr up to FY 2023-24, 30 Jun from FY 2024-25 onward
-- (53rd GST Council meeting, CGST Notification 12/2024, 10 Jul 2024).
insert into public.compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, notification_ref, effective_from, active)
values
  ('GSTR-4', 'annual',
   '{"type": "fixed_date", "day": 30, "month": 4, "year_offset": 1, "max_fy_start_year": 2023}'::jsonb,
   '{"per_day": 50, "max": 2000, "nil_per_day": 20, "nil_max": 500}'::jsonb,
   'CGST Act Section 47 (pre CGST Notification 12/2024)', '2017-07-01', true),
  ('GSTR-4', 'annual',
   '{"type": "fixed_date", "day": 30, "month": 6, "year_offset": 1, "min_fy_start_year": 2024}'::jsonb,
   '{"per_day": 50, "max": 2000, "nil_per_day": 20, "nil_max": 500}'::jsonb,
   'CGST Notification 12/2024 dated 10 Jul 2024', '2024-07-10', true);

-- GSTR-9C shares GSTR-9's due date (both are the annual-return-family filing
-- for the same FY, filed together in practice).
insert into public.compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, notification_ref, effective_from, active)
values (
  'GSTR-9C', 'annual',
  '{"type": "fixed_date", "day": 31, "month": 12, "year_offset": 1}'::jsonb,
  null,
  'CGST Act Section 44', '2017-07-01', true
);

insert into public.compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, interest_section, notification_ref, effective_from, active)
values (
  'CMP-08', 'quarterly',
  '{"type": "fixed_day", "day": 18, "month_offset": 1, "after_quarter_end": true}'::jsonb,
  null, null,
  'CGST Rules Rule 62', '2019-04-01', true
);

insert into public.compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, notification_ref, effective_from, active)
values (
  'TAX_AUDIT', 'annual',
  '{"type": "fixed_date", "day": 30, "month": 9, "year_offset": 1}'::jsonb,
  null,
  'Income Tax Act Section 44AB / 139(1)', '2020-04-01', true
);

-- Every-calendar-year deadline, not FY-relative — year_offset 0 against the
-- selected FY's start year matches the existing (unflagged, so presumed
-- correct) behaviour this replaces.
insert into public.compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, notification_ref, effective_from, active)
values (
  'DIR-3 KYC', 'annual',
  '{"type": "fixed_date", "day": 30, "month": 9, "year_offset": 0}'::jsonb,
  '{"per_day": 5000, "flat": true}'::jsonb,
  'Companies Act Rule 12A', '2018-07-10', true
);

-- AOC-4/MGT-7 late fee: flat Rs100/day per form, no upper cap. No
-- due_date_rule row (yet) since it's relative to each company's own AGM
-- date, not the FY alone -- out of scope for this pass (needs a per-client
-- AGM date field, same class of gap as the QRMP flag).
insert into public.compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, interest_section, notification_ref, effective_from, active)
values (
  'ROC_ANNUAL_FILING', 'annual',
  null,
  '{"per_day": 100}'::jsonb,
  'Section 403',
  'Companies Act 2013 Section 403', '2018-07-07', true
);
