-- H6 (ISSUES.md) — model the last 7 filing types that still had a null
-- late_fee_rule, each by its actual statutory basis rather than forcing a
-- wrong single number (the mistake H6 exists to prevent). The resolver
-- (src/data/ComplianceRules.ts, computeLateFee) grew four new shapes for the
-- ones the existing flat/per-day/slab shapes couldn't express: a compound
-- company-flat + officer-per-day (INC-20A), a flat percentage-of-turnover
-- with an absolute cap (tax audit), an interest shape (CMP-08 / TDS challan),
-- and the MCA capital-slab × delay-multiplier additional fee (ADT-1). The
-- other two reuse existing shapes.

-- Form 16 (Sec 272A(2)(g)): ₹100/day, capped at the TDS amount. Same shape
-- as the TDS return row.
update public.compliance_rules
set late_fee_rule = '{"per_day": 100, "max_equals_tds": true}'::jsonb
where filing_type = 'FORM_16';

-- PAS-3, return of allotment (Sec 39(5)): ₹1,000/day or ₹1,00,000, whichever
-- is less. hard_max (flat cap), NOT `max` — `max` is the GST base cap that
-- scales with turnover, which must not apply here.
update public.compliance_rules
set late_fee_rule = '{"per_day": 1000, "hard_max": 100000}'::jsonb
where filing_type = 'PAS-3';

-- INC-20A, commencement of business (Sec 10A(2)): flat ₹50,000 on the company
-- PLUS ₹1,000/day on every officer in default, the officer portion capped at
-- ₹1,00,000. Compound.
update public.compliance_rules
set late_fee_rule = '{"company_flat": 50000, "officer_per_day": 1000, "officer_max": 100000}'::jsonb
where filing_type = 'INC-20A';

-- Tax audit report (Sec 271B): 0.5% of total turnover/sales/gross receipts,
-- capped at ₹1,50,000 — a one-time penalty on default, not a per-day accrual.
update public.compliance_rules
set late_fee_rule = '{"flat_pct_of_turnover": 0.005, "max_amount": 150000}'::jsonb
where filing_type = 'TAX_AUDIT';

-- CMP-08 (Sec 50): no filing late fee exists for the composition statement —
-- the charge is interest at 18% p.a. on the unpaid composition tax, accrued
-- per day (×days/365).
update public.compliance_rules
set late_fee_rule = '{"interest": {"rate": 0.18, "period": "annual", "on": "tax"}}'::jsonb
where filing_type = 'CMP-08';

-- TDS challan, late deposit (Sec 201(1A)): interest at 1.5% per month or part
-- of a month on the TDS deducted but not deposited on time.
update public.compliance_rules
set late_fee_rule = '{"interest": {"rate": 0.015, "period": "monthly", "on": "tds"}}'::jsonb
where filing_type = 'TDS_CHALLAN';

-- ADT-1, auditor appointment (Sec 139): the MCA additional fee = a normal fee
-- fixed by the company's nominal share capital × a delay multiplier (2x/4x/6x/
-- 10x/12x by days late). Unlike AOC-4/MGT-7, ADT-1 kept this multiplier
-- structure (it wasn't moved to the flat ₹100/day in the 2018 amendment).
update public.compliance_rules
set late_fee_rule = '{"mca_capital_slab_fee": true}'::jsonb
where filing_type = 'ADT-1';
