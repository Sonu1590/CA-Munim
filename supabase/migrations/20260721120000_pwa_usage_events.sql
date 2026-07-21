-- Mobile app usage signal: the PWA (vite.config.ts's VitePWA, display:
-- "standalone") had no instrumentation at all — no way to tell how many
-- users have installed it or launched it from a home-screen icon. This adds
-- a minimal event log the client writes to at three points: when a session
-- starts already running in standalone display mode, when the browser
-- offers the install prompt, and when the user actually installs.
--
-- Inserts go through log_pwa_usage_event() (SECURITY DEFINER, firm_id/user_id
-- derived server-side from auth.uid() via get_my_firm_id()) rather than a
-- direct table INSERT policy — same reasoning as every other write-scoping
-- RPC in this app (see ensure_my_firm_rpc migration): the client should
-- never be trusted to assert its own firm_id.
create table public.pwa_usage_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  user_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('standalone_launch', 'prompt_shown', 'installed')),
  user_agent text,
  created_at timestamptz not null default now()
);

create index pwa_usage_events_firm_id_idx on public.pwa_usage_events (firm_id, created_at desc);

alter table public.pwa_usage_events enable row level security;

-- Firms can read back their own signal (a future "install adoption" widget
-- would query this); there is no direct INSERT policy since all writes go
-- through the RPC below.
create policy pwa_usage_events_select on public.pwa_usage_events
  for select using (firm_id = public.get_my_firm_id());

create or replace function public.log_pwa_usage_event(p_event_type text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pwa_usage_events (firm_id, user_id, event_type, user_agent)
  values (public.get_my_firm_id(), auth.uid(), p_event_type, p_user_agent);
end;
$$;

revoke all on function public.log_pwa_usage_event(text, text) from public;
grant execute on function public.log_pwa_usage_event(text, text) to authenticated;
