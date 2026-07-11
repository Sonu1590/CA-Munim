-- H6 remaining gap (ISSUES.md): GST monthly/quarterly late-fee cap and
-- GSTR-9 late fee were still wrong in the live compliance_rules data even
-- though the resolver (src/data/ComplianceRules.ts) already had correct
-- turnover-slab logic for the GST monthly/quarterly shape — the stored
-- `max` was 10000 (the >5cr slab value) instead of 2000 (the <=1.5cr base
-- the resolver scales up by 2.5x/5x), so every filer regardless of
-- turnover was shown the largest slab's cap, a ~5x overstatement for the
-- majority of a typical CA's book (small clients). nil_max was also never
-- set, so nil-return penalties were silently uncapped.

update public.compliance_rules
set late_fee_rule = jsonb_set(
  jsonb_set(late_fee_rule, '{max}', '2000'),
  '{nil_max}', '500'
)
where filing_type in ('GSTR-1_MONTHLY', 'GSTR-1_QRMP', 'GSTR-3B_MONTHLY_ABOVE5CR', 'GSTR-3B_QRMP_CAT1', 'GSTR-3B_QRMP_CAT2');

-- GSTR-9 (Notification 07/2023-CT): the per-day rate itself changes by
-- turnover slab, not just the cap, so the old single per_day/max_percentage
-- shape couldn't represent it correctly (was storing a flat 200/day and a
-- nonsensical 25% cap). Replaced with the new `slabs` shape the resolver
-- now understands: <=5cr turnover is 50/day capped at 0.04%, 5-20cr is
-- 100/day capped at 0.04%, >20cr is 200/day capped at 0.50%.
update public.compliance_rules
set late_fee_rule = jsonb_build_object(
  'slabs', jsonb_build_array(
    jsonb_build_object('turnover_upto', 50000000, 'per_day', 50, 'max_percentage', 0.0004),
    jsonb_build_object('turnover_upto', 200000000, 'per_day', 100, 'max_percentage', 0.0004),
    jsonb_build_object('turnover_upto', null, 'per_day', 200, 'max_percentage', 0.005)
  )
)
where filing_type = 'GSTR-9';
