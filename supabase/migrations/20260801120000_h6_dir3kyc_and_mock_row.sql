-- H6 residual (ISSUES.md) — closed after re-checking the LIVE compliance_rules
-- table (not the stale 2026-07-10 note, which still listed CMP-08/DIR-3 KYC/
-- GSTR-4 as "missing": all three are in fact present now). Ground-truth query
-- surfaced two real data defects the note never mentioned, both fixed here.

-- (1) DIR-3 KYC late fee computed as ₹0 instead of the real flat ₹5,000.
-- The row stored late_fee_rule as {"flat":true,"per_day":5000}, but the
-- resolver's `flat` branch (computeLateFee in src/data/ComplianceRules.ts)
-- reads `amount`, not `per_day` — DIR-3 KYC is a one-time flat penalty
-- (Rule 12A, Companies (Appointment & Qualification of Directors) Rules),
-- not a per-day accrual, so `per_day` was the wrong key both semantically and
-- mechanically. Re-encode as {"flat":true,"amount":5000} so it yields ₹5,000.
-- Latent today (only the Penalty Calculator's 6 filing types call
-- computeLateFee, and DIR-3 KYC isn't one of them) but wrong data that would
-- surface as ₹0 the moment DIR-3 KYC is shown anywhere.
update public.compliance_rules
set late_fee_rule = '{"flat": true, "amount": 5000}'::jsonb
where filing_type = 'DIR-3 KYC';

-- (2) DIR-3 KYC due date was a year early relative to how the app labels every
-- OTHER annual filing. It stored year_offset:0, so selecting "FY 2025-26" in
-- BulkTaskGenerator (fyStart=2025) produced a 2025-09-30 deadline — six months
-- before FY2025-26 even ends. Every other annual filing here (GSTR-9, ITR_*,
-- GSTR-4, TAX_AUDIT, GSTR-9C) uses fyStart+1, i.e. the deadline lands in the
-- calendar year after the FY starts. DIR-3 KYC for a given FY (DINs held as on
-- 31 Mar of that FY) is due 30 Sep of the immediately following FY — "DIR-3 KYC
-- FY 2024-25" → 30 Sep 2025 → fyStart(2024)+1. Setting year_offset:1 both makes
-- it statutorily correct under the app's own FY-labelling convention and stops
-- it being the lone inconsistent annual row. If the product actually intends to
-- label DIR-3 KYC by the calendar year its 30 Sep deadline falls in (year_offset
-- 0), revert just this statement — the fee fix above is independent of it.
update public.compliance_rules
set due_date_rule = jsonb_set(due_date_rule, '{year_offset}', '1')
where filing_type = 'DIR-3 KYC';

-- (3) Remove a stray mock row. filing_type 'GST' (not a real filing type —
-- the real ones are GSTR-1/GSTR-3B/etc.), notification_ref 'NOTIF-MOCK-001',
-- interest_section 'Sec 123', an invalid due_date_rule type "fixed" the
-- resolver doesn't handle, created 2026-05-09 (before any tracked migration —
-- inserted manually during earlier testing, never via a migration). It is
-- already active:false so fetchComplianceRulesFromSupabase's .eq('active',
-- true) never returns it, but compliance_rules is a global reference table (no
-- firm_id) and leaving mock data in it is the same pollution class as L5.
-- Narrowly scoped so it can only ever match this one mock row.
delete from public.compliance_rules
where filing_type = 'GST' and notification_ref = 'NOTIF-MOCK-001';
