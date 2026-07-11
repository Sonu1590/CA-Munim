-- (M12) Backfill pre-existing invoice rows whose GST amounts were stored as
-- raw unrounded JS floats (e.g. 789 * 0.18 === 142.01999999999998) before the
-- createInvoice() roundMoney() fix landed. Rounds each currency column to 2dp
-- in place -- this does NOT recompute GST from subtotal/rate, it only fixes
-- the float representation of values that were already computed correctly.
--
-- WHERE predicate is general (any invoice row whose numeric currency column
-- isn't exactly 2dp) rather than pinned to a specific id, so this migration
-- is self-documenting and will also catch any other pre-existing bad rows
-- beyond the one found during audit (only one was found as of 2026-07-11:
-- id 52e93713-d011-4239-9fa5-57c74d79f90f, invoice_number INV-202627-0001).
UPDATE invoices
SET
  subtotal = round(subtotal::numeric, 2),
  cgst = round(cgst::numeric, 2),
  sgst = round(sgst::numeric, 2),
  igst = round(igst::numeric, 2),
  total = round(total::numeric, 2)
WHERE subtotal <> round(subtotal::numeric, 2)
   OR cgst <> round(cgst::numeric, 2)
   OR sgst <> round(sgst::numeric, 2)
   OR igst <> round(igst::numeric, 2)
   OR total <> round(total::numeric, 2);
