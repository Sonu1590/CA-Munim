-- Email fallback backlog item (Fable PM review, 2026-07-06 / ISSUES.md
-- "Also missing"): "for the minority of clients not reachable on WhatsApp."
-- send-task-reminders (P3 scheduler) now tries WhatsApp first and only
-- falls back to email when there's no phone number or the WhatsApp send
-- failed, so this table exists purely to log that second channel — same
-- shape/purpose as whatsapp_sent_messages, kept separate rather than a
-- polymorphic "channel" column so each channel's provider-specific fields
-- (wamid vs provider_message_id) stay typed instead of a shared jsonb blob.

create table public.email_sent_messages (
  id uuid primary key default uuid_generate_v4(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  provider_message_id text,
  sent_at timestamptz not null default now()
);

create index email_sent_messages_firm_sent_at_idx on public.email_sent_messages (firm_id, sent_at desc);

alter table public.email_sent_messages enable row level security;

-- Only the SECURITY DEFINER-free service-role client (the scheduled edge
-- function) writes here, same as whatsapp_sent_messages; this policy is
-- for firm staff reading their own firm's log.
create policy email_sent_messages_firm_only
  on public.email_sent_messages
  for all
  using (firm_id = public.get_my_firm_id());
