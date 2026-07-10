-- QRMP backlog item (Fable PM review, 2026-07-06): "without knowing whether a
-- client files monthly or quarterly, you cannot compute their correct
-- GSTR-1/3B due dates." GSTR-3B_QRMP_CAT1/CAT2 rows already exist (H6 P2);
-- this adds the missing GSTR-1 QRMP rule (13th of the month after quarter-end,
-- Rule 59(1) 4th proviso — same for every state, unlike GSTR-3B's 22nd/24th
-- split) and documents the CAT1/CAT2 state split on applicable_states, which
-- existed on the table since P2 but was never populated.

update compliance_rules
set applicable_states = array[
  'Chhattisgarh', 'Madhya Pradesh', 'Gujarat', 'Maharashtra', 'Karnataka',
  'Goa', 'Kerala', 'Tamil Nadu', 'Telangana', 'Andhra Pradesh',
  'Daman and Diu', 'Dadra and Nagar Haveli', 'Puducherry',
  'Andaman and Nicobar', 'Lakshadweep'
]
where filing_type = 'GSTR-3B_QRMP_CAT1';

update compliance_rules
set applicable_states = array[
  'Himachal Pradesh', 'Punjab', 'Uttarakhand', 'Haryana', 'Rajasthan',
  'Uttar Pradesh', 'Bihar', 'Sikkim', 'Arunachal Pradesh', 'Nagaland',
  'Manipur', 'Mizoram', 'Tripura', 'Meghalaya', 'Assam', 'West Bengal',
  'Jharkhand', 'Odisha', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh'
]
where filing_type = 'GSTR-3B_QRMP_CAT2';

insert into compliance_rules
  (filing_type, financial_year, period_type, due_date_rule, late_fee_rule, notification_ref, effective_from)
values (
  'GSTR-1_QRMP', '2025-26', 'quarterly',
  '{"type": "fixed_day", "day": 13, "month_offset": 1}'::jsonb,
  '{"per_day": 50, "nil_per_day": 20, "max": 10000}'::jsonb,
  'CGST Rule 59(1), 4th proviso',
  '2025-04-01'
);
