-- Support real delivery/read status tracking and the Inbox tab, both of
-- which currently have working UI + DB plumbing but nothing populating
-- them: there is no webhook receiver, and no way to correlate an incoming
-- Meta status update back to the row it's about.
--
-- Meta's status webhooks reference the outbound message by its own id
-- (the "wamid", returned in the send response as messages[0].id). Store it
-- at send time so the new whatsapp-webhook function can look up the right
-- row with `where wamid = <id>` instead of guessing from phone/timestamp.
alter table public.whatsapp_sent_messages
  add column if not exists wamid text;

create index if not exists whatsapp_sent_messages_wamid_idx
  on public.whatsapp_sent_messages (wamid)
  where wamid is not null;
