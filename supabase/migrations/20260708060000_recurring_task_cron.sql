-- Schedules generate-recurring-tasks at 02:00 UTC, an hour before
-- send-task-reminders (03:00 UTC) — a task generated today needs to exist
-- before the reminder scan runs the same morning.
select cron.schedule(
  'generate-recurring-tasks-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://djzsjkjdvzqxybltikmr.supabase.co/functions/v1/generate-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'ktYNhaQ6lKbNr6fNU8wtimgWX3V744Dg'
    ),
    body := '{}'::jsonb
  );
  $$
);
