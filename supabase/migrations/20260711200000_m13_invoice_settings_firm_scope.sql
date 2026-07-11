-- M13 (ISSUES.md): src/data/Settings.ts's fetchInvoiceSettingsFromSupabase/
-- saveInvoiceSettingsToSupabase queried/wrote columns that don't exist on
-- invoice_settings (reset_per_fy/payment_terms/footer_notes instead of the
-- real reset_annually/default_terms/default_notes) -- every fetch errored
-- and silently fell back to mockInvoiceSettings (the L5 failure mode).
-- Separately, saveInvoiceSettingsToSupabase upserted a hardcoded id: 1 and
-- never set firm_id at all; the firm_only RLS policy
-- (firm_id = get_my_firm_id(), applies to all commands including the
-- WITH CHECK on writes) rejected every save as a result. Confirmed live:
-- `select count(*) from invoice_settings` returned 0 despite this being a
-- settings feature firms would have tried to configure.
--
-- The app-code fix (this migration's companion commit) now upserts with
-- firm_id set and onConflict: 'firm_id', which requires a unique
-- constraint on firm_id to work as an upsert target -- none existed.
-- firm_id was also nullable, which would let a row silently opt out of
-- the one-row-per-firm invariant this fix depends on; there are 0 rows
-- live so tightening to NOT NULL here is safe and free.
alter table public.invoice_settings
  alter column firm_id set not null;

alter table public.invoice_settings
  add constraint invoice_settings_firm_id_key unique (firm_id);
