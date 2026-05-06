-- Reminder notifications log: tracks repeating reminders per envelope
-- Unlike sent_notifications (unique per envelope), reminders can fire multiple times.
create table if not exists sent_reminders (
  id             uuid primary key default gen_random_uuid(),
  envelope_id    text not null,
  reminder_index int  not null default 1,
  title          text,
  body           text,
  recipients     int default 0,
  sent_at        timestamptz default now(),
  unique(envelope_id, reminder_index)
);

alter table sent_reminders enable row level security;
-- Only the Edge Function (service role key) writes to this table
