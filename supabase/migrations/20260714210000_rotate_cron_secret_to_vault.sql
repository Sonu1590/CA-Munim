-- Rotate the leaked cron secret and stop inlining it in migration files
-- (Fable review, 2026-07-14 — NEW CRITICAL).
--
-- 20260707120000_scheduled_reminders.sql and 20260708060000_recurring_task_cron.sql
-- both inlined the literal x-cron-secret value into a committed migration.
-- The repo is public, so that value was exposed to anyone who cloned it —
-- meaning send-task-reminders/generate-recurring-tasks could be invoked
-- directly by an outside caller (real WhatsApp sends on the firm's Meta
-- bill, or unbounded task generation), bypassing the fact that these
-- functions have no other auth check (pg_cron has no user session to
-- attach a JWT to, so the shared-secret header was the only gate).
--
-- Fix: the secret itself now lives only in Supabase Vault (already used by
-- the client credential vault feature — see client_credential_vault.sql),
-- looked up by name at cron-execution time via vault.decrypted_secrets
-- instead of being embedded as a literal string. This migration only
-- repoints the two existing cron.job commands at the vault lookup; it does
-- not contain a secret value, so it's safe to commit. The actual secret
-- was rotated and inserted directly via vault.create_secret(), run once by
-- hand (not as a migration) exactly per this same "don't commit it"
-- reasoning.
--
-- This still requires the Edge Functions' own CRON_SECRET env var to be
-- updated to match — that has to happen outside a migration (Dashboard or
-- `supabase secrets set`, no MCP tool exists for it) since it's function
-- config, not database state.

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'send-task-reminders-daily'),
  command := $$
  select net.http_post(
    url := 'https://djzsjkjdvzqxybltikmr.supabase.co/functions/v1/send-task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'generate-recurring-tasks-daily'),
  command := $$
  select net.http_post(
    url := 'https://djzsjkjdvzqxybltikmr.supabase.co/functions/v1/generate-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
