-- M9 (ISSUES.md): invoices had no real due date -- every place that needed
-- one (FeesDashboard's overdue check, the receivables aging report) treated
-- dueDate as literally equal to invoice_date, so "overdue"/aging was really
-- "days since invoiced," not "days past the agreed payment term." A firm
-- using Net 15/30/45 terms saw wrong overdue flags and wrong aging buckets.
--
-- payment_terms was free text in practice (only two values ever seen live:
-- 'Due on receipt' and null) and the invoice-creation UI never actually
-- exposed a way to set it -- CreateInvoiceModal only had a single "Notes /
-- Payment Terms" free-text field, and didn't even pass payment_terms to
-- createInvoice. So this migration also constrains payment_terms to a real
-- structured set the UI can drive (see CreateInvoiceModal.tsx / useBilling.ts
-- in this same change), rather than adding due_date next to a field nothing
-- reliably populated.

alter table public.invoices add column due_date date;

-- Normalize the one real free-text value seen live to its structured form.
update public.invoices set payment_terms = 'due_on_receipt' where lower(trim(payment_terms)) = 'due on receipt';

-- Backfill: no better signal exists for pre-existing rows than the firm's
-- own stated default ("Payment due within 15 days of invoice date" --
-- see invoice_settings.default_terms's mock/documented default), so
-- anything not already 'due_on_receipt' backfills to net_15.
update public.invoices set payment_terms = 'net_15' where payment_terms is distinct from 'due_on_receipt';

alter table public.invoices
  add constraint invoices_payment_terms_check
  check (payment_terms in ('due_on_receipt', 'net_15', 'net_30', 'net_45'));

alter table public.invoices alter column payment_terms set default 'net_15';
alter table public.invoices alter column payment_terms set not null;

-- Backfill due_date from the now-structured payment_terms.
update public.invoices set due_date = case payment_terms
  when 'due_on_receipt' then invoice_date
  when 'net_15' then invoice_date + interval '15 days'
  when 'net_30' then invoice_date + interval '30 days'
  when 'net_45' then invoice_date + interval '45 days'
end::date;

alter table public.invoices alter column due_date set not null;
