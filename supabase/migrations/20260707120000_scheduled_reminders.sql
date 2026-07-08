-- The scheduler: "a reminder product that cannot remind" (architect review,
-- 2026-07-06). Nothing in the app ran when a CA wasn't looking at the
-- screen — "Send Reminder" was a button a human had to click. This adds a
-- daily cron job that finds tasks due in 3 days and sends a WhatsApp
-- reminder automatically, once per task.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.tasks
  add column if not exists reminder_sent_at timestamptz;

-- Runs daily at 03:00 UTC (08:30 IST) — well before a CA's working day, so
-- reminders are already sent by the time anyone checks WhatsApp.
-- The edge function checks a shared secret header rather than verify_jwt,
-- since pg_cron has no user session to attach (same pattern as the
-- whatsapp-webhook function's signature check). The secret is inlined here
-- rather than stored in Vault: there's no MCP tool to set edge function
-- secrets (Dashboard/CLI only, confirmed earlier this session), so the same
-- value also needs to be set as the function's CRON_SECRET manually — Vault
-- would just be a second place for that value to drift from the real one.
-- This isn't defending against DB-level access (anyone with that already
-- has everything); it only stops the public function URL being triggered
-- by an outside caller.
select cron.schedule(
  'send-task-reminders-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://djzsjkjdvzqxybltikmr.supabase.co/functions/v1/send-task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'ktYNhaQ6lKbNr6fNU8wtimgWX3V744Dg'
    ),
    body := '{}'::jsonb
  );
  $$
);
