-- Fix the INV-MOCK-0001 row's zero GST instead of fabricating it at read
-- time (Fable review, 2026-07-14 — "still present" finding).
--
-- src/data/Billing.ts had a mockGstFallback branch: any invoice numbered
-- INV-MOCK* with zero stored cgst/sgst/igst got an 18% split invented on
-- the fly for display, while the stored `total` stayed at the bare
-- subtotal. Exactly one live row matched (INV-MOCK-0001, a draft,
-- subtotal 5000, cgst/sgst/igst all 0, total 5000) — a leftover seed/demo
-- row, not real client data (status is still 'draft', never sent).
--
-- Rather than keep inventing the split in the frontend on every read,
-- write the real numbers once. Matches the fallback's own prior
-- assumption (intra-state, cgst/sgst split, no igst) so nothing a user
-- has already seen for this row changes.
update public.invoices
set cgst = 450,
    sgst = 450,
    igst = 0,
    total = 5900
where invoice_number = 'INV-MOCK-0001'
  and cgst = 0 and sgst = 0 and igst = 0
  and total = subtotal;
