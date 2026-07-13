-- H6/ISSUES.md: INC-20A and PAS-3 are one-time, event-based filings that
-- generate-recurring-tasks has always excluded ("event-based/one-time
-- services... a different and larger gap than AGM month"). Both are
-- already selectable TaskTypes in BulkTaskGenerator's ROC/MCA group, but
-- with no compliance_rules row, selecting either there silently falls
-- back to a made-up "20th of following month" -- wrong for a filing whose
-- real due date is a fixed offset from a specific event.
--
-- INC-20A (commencement of business, Section 10A): 180 days from
-- incorporation. Reuses clients.date_of_birth, which already doubles as
-- the incorporation date for company-type clients (see its column
-- comment) -- no new column needed.
--
-- PAS-3 (return of allotment, Section 39/42): 30 days from the share
-- allotment date, which nothing captures yet -- adds
-- clients.last_allotment_date.
alter table public.clients add column if not exists last_allotment_date date;

-- late_fee_rule left null for both: the actual penalty structures are
-- compound in a way the existing flat/per_day shapes would misrepresent
-- (INC-20A: flat ₹50,000 on the company *plus* ₹1,000/day per officer in
-- default up to ₹1,00,000, two different amounts on two different
-- parties; PAS-3: up to ₹2cr or the amount raised, whichever is lower,
-- not a per-day accrual at all). This task is scoped to due dates —
-- shipping a guessed penalty number would repeat exactly the mistake H6
-- was opened to fix, so leaving it unmodeled is safer than a wrong one.
insert into compliance_rules (filing_type, period_type, due_date_rule, late_fee_rule, interest_section, notification_ref, effective_from)
values
  ('INC-20A', 'annual', '{"type": "relative_to_client_date", "field": "date_of_birth", "offset_days": 180}'::jsonb, null, 'Section 10A, Companies Act 2013', 'Companies Act 2013', '2019-11-18'),
  ('PAS-3', 'annual', '{"type": "relative_to_client_date", "field": "last_allotment_date", "offset_days": 30}'::jsonb, null, 'Section 39/42, Companies Act 2013', 'Companies Act 2013', '2018-08-13');
