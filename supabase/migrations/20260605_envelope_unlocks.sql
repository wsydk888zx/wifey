-- Envelope unlocks: per-envelope dynamic unlock times
-- Used when a choice triggers a sequence of envelopes whose scheduledAt
-- isn't a static timestamp but is computed at pick-time (e.g. Day 2 confession drops).
-- The player reads from this table; the send-scheduled-notifications edge function
-- treats unlock_at as effective scheduledAt when no static scheduledAt exists.

create table if not exists envelope_unlocks (
  envelope_id  text primary key,
  unlock_at    timestamptz not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table envelope_unlocks enable row level security;

-- Player (anon) reads unlock times to gate the envelope UI
drop policy if exists "anon can read envelope_unlocks" on envelope_unlocks;
create policy "anon can read envelope_unlocks"
  on envelope_unlocks for select
  to anon
  using (true);

-- Player (anon) writes when a branching choice schedules its children
drop policy if exists "anon can insert envelope_unlocks" on envelope_unlocks;
create policy "anon can insert envelope_unlocks"
  on envelope_unlocks for insert
  to anon
  with check (true);

drop policy if exists "anon can update envelope_unlocks" on envelope_unlocks;
create policy "anon can update envelope_unlocks"
  on envelope_unlocks for update
  to anon
  using (true)
  with check (true);

-- Admin (authenticated) can read all rows
drop policy if exists "authenticated can read envelope_unlocks" on envelope_unlocks;
create policy "authenticated can read envelope_unlocks"
  on envelope_unlocks for select
  to authenticated
  using (true);

drop policy if exists "authenticated can delete envelope_unlocks" on envelope_unlocks;
create policy "authenticated can delete envelope_unlocks"
  on envelope_unlocks for delete
  to authenticated
  using (true);
