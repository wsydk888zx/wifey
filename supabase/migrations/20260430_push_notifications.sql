-- Push subscriptions: one row per device
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

-- Sent notifications log: prevents re-sending
create table if not exists sent_notifications (
  id          uuid primary key default gen_random_uuid(),
  envelope_id text not null unique,
  title       text,
  body        text,
  recipients  int default 0,
  sent_at     timestamptz default now()
);

-- RLS: player can insert/upsert its own subscription
alter table push_subscriptions enable row level security;
create policy "anon can upsert subscriptions"
  on push_subscriptions for all
  to anon
  using (true)
  with check (true);

-- sent_notifications is only written by the Edge Function (service role key), no anon access
alter table sent_notifications enable row level security;
