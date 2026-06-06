-- Notification controls: global settings + one-shot command queue.
-- Powers the admin "Mission Control" levers (pause, shift-all, re-anchor, send-now)
-- and the pace-adaptive scheduling rewrite in send-scheduled-notifications.
--
-- Design notes:
--  * notification_settings is a singleton row (id = 'main').
--  * paused defaults TRUE so the rebuilt scheduler ships OFF — nothing fires until
--    the admin explicitly resumes from Mission Control.
--  * anchor_at = when "her clock" starts (envelope 1 fires at anchor). If NULL the
--    edge function falls back to the earliest push_subscriptions.created_at, so the
--    journey auto-anchors to when she first subscribes.
--  * shift_minutes is added to every computed fire time (global ± nudge).
--  * notification_commands is a tiny queue the edge function drains each minute;
--    'send_now' fires one envelope immediately (manual override, ignores pause).

create table if not exists notification_settings (
  id            text primary key default 'main',
  paused        boolean not null default true,
  anchor_at     timestamptz,
  shift_minutes integer not null default 0,
  updated_at    timestamptz not null default now()
);

insert into notification_settings (id, paused)
values ('main', true)
on conflict (id) do nothing;

create table if not exists notification_commands (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('send_now')),
  envelope_id  text,
  status       text not null default 'pending' check (status in ('pending','done','error')),
  result       text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists notification_commands_pending_idx
  on notification_commands (created_at)
  where status = 'pending';

-- RLS: only authenticated users (the admin accounts are the only ones who can log
-- in) may read/write. The edge function uses the service role and bypasses RLS.
alter table notification_settings enable row level security;
alter table notification_commands enable row level security;

drop policy if exists "settings_admin_read"   on notification_settings;
drop policy if exists "settings_admin_update" on notification_settings;
drop policy if exists "settings_admin_insert" on notification_settings;
create policy "settings_admin_read"   on notification_settings for select using (auth.uid() is not null);
create policy "settings_admin_update" on notification_settings for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "settings_admin_insert" on notification_settings for insert with check (auth.uid() is not null);

drop policy if exists "commands_admin_read"   on notification_commands;
drop policy if exists "commands_admin_insert" on notification_commands;
create policy "commands_admin_read"   on notification_commands for select using (auth.uid() is not null);
create policy "commands_admin_insert" on notification_commands for insert with check (auth.uid() is not null);
