-- H6 remaining gap (ISSUES.md): MGT-7/AOC-4/ADT-1 due dates are relative to
-- a company's AGM, not the FY itself, so they never had compliance_rules
-- rows -- there was nowhere for the FY-anchored resolver to compute them
-- from. clients.agm_due_month is now captured via AddClientModal (M14),
-- so these are unblocked. due_date_rule uses the new "relative_to_agm"
-- shape (src/data/ComplianceRules.ts's computeDueDate): offset_days from
-- the last day of agm_due_month in the calendar year after the FY starts.
--
-- AOC-4: 30 days from AGM (Section 137, Companies Act 2013).
-- MGT-7: 60 days from AGM (Section 92).
-- ADT-1 (auditor appointment): 15 days from AGM (Section 139).
insert into compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, interest_section, notification_ref, effective_from)
values
  ('MGT-7', 'annual', '{"type": "relative_to_agm", "offset_days": 60}'::jsonb, '{"per_day": 100}'::jsonb, 'Section 92, Companies Act 2013', 'Companies Act 2013', '2018-07-07'),
  ('AOC-4', 'annual', '{"type": "relative_to_agm", "offset_days": 30}'::jsonb, '{"per_day": 100}'::jsonb, 'Section 137, Companies Act 2013', 'Companies Act 2013', '2018-07-07'),
  ('ADT-1', 'annual', '{"type": "relative_to_agm", "offset_days": 15}'::jsonb, null, 'Section 139, Companies Act 2013', 'Companies Act 2013', '2013-04-01');

-- Bonus (nearly free while touching this table): Form 16 already had a
-- verified-correct due date (15 June, per ISSUES.md H6's original audit)
-- but was still only hardcoded in the frontend, not in this table.
insert into compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, interest_section, notification_ref, effective_from)
values ('FORM_16', 'annual', '{"type": "fixed_date", "day": 15, "month": 6}'::jsonb, null, 'Section 203, Income Tax Act', 'Rule 31, Income Tax Rules', '2019-04-01');
