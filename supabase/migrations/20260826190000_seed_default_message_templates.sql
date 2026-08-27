-- New-firm onboarding never seeded any WhatsApp templates, so a brand-new
-- firm's WhatsApp Center was unusable until someone happened to notice and
-- manually create matching templates (found via a user report; see ISSUES.md,
-- "Template picker only shows Mock Reminder"). Confirmed live: 9 of 11 firms
-- in the project have zero message_templates rows.
--
-- This matters specifically because CA Munim uses ONE SHARED WhatsApp
-- Business Account/phone number across every firm (WHATSAPP_ACCESS_TOKEN/
-- WHATSAPP_PHONE_NUMBER_ID are singular Edge Function secrets, not per-firm) —
-- so the same handful of Meta-approved templates are the entire universe of
-- what ANY firm can ever send. There's no "your firm's templates aren't
-- approved yet" step to wait on; the only thing missing was the local
-- message_templates rows that compile a template's body/variables into the
-- parameters Meta needs. Every firm should get them automatically.
--
-- Anchored to `firms` itself (AFTER INSERT), not to handle_new_user() or
-- ensure_my_firm() individually, so it fires regardless of which of the
-- app's canonical firm-creation paths actually runs (see CLAUDE.md's
-- firm-creation history / H1) — one seed point, not duplicated per path.
-- SECURITY DEFINER + empty search_path + a caught exception, matching
-- handle_new_user()'s own defensive style: a seeding failure must never
-- break firm creation itself.
--
-- Bodies/variables copied verbatim from the templates already verified live
-- against Active, Meta-approved templates in WhatsApp Manager (documents_pending,
-- gst_filing_reminder, itr_filing_reminder, invoice_payment_due).

create or replace function public.seed_default_message_templates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.message_templates (firm_id, name, category, body, variables, is_default)
  values
    (new.id, 'Documents Pending', 'GST',
     E'Dear {{client_name}},\n\nWe are yet to receive the following documents for your {{filing_type}} filing:\n\n- Bank statements\n- Purchase/Sales invoices\n- Any other supporting documents\n\nPlease share them via WhatsApp or upload at: {{upload_link}}\n\nDeadline: {{due_date}}\n\n- {{firm_name}}',
     '["client_name","filing_type","upload_link","due_date","firm_name"]'::jsonb, false),

    (new.id, 'GST Filing Reminder', 'GST',
     E'Dear {{client_name}},\n\nThis is a reminder that your GST Return (GSTR-3B) for {{filing_type}} is due on {{due_date}}.\n\nKindly share the following:\n- Sales invoices\n- Purchase invoices\n- Bank statement\n\nPlease contact us at your earliest. Thank you!\n\n- {{firm_name}}',
     '["client_name","filing_type","due_date","firm_name"]'::jsonb, false),

    (new.id, 'ITR Filing Reminder', 'Income Tax',
     E'Dear {{client_name}},\n\nYour Income Tax Return (ITR) for AY 2026-27 is due on 31st July 2026.\n\nTo proceed, please share:\n- Form 16 / P&L Statement\n- Bank statements (Apr-Mar)\n- Investment proofs (80C, 80D etc.)\n\nContact us to avoid last-minute rush!\n\n- {{firm_name}}',
     '["client_name","firm_name"]'::jsonb, false),

    (new.id, 'Invoice Payment Due', 'Billing',
     E'Dear {{client_name}},\n\nThis is a gentle reminder that Invoice #{{invoice_number}} of ₹{{amount}} is due for payment.\n\nPlease complete the payment at the earliest to avoid any service interruption.\n\nPayment via UPI / NEFT accepted.\n\nThank you!\n- {{firm_name}}',
     '["client_name","invoice_number","amount","firm_name"]'::jsonb, false);
  return new;
exception
  when others then
    raise log 'seed_default_message_templates failed for firm %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists seed_message_templates_on_firm_create on public.firms;
create trigger seed_message_templates_on_firm_create
  after insert on public.firms
  for each row execute function public.seed_default_message_templates();
