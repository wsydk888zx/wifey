-- ─────────────────────────────────────────────────────────────────────────────
-- Separate notification / gating config from story content.
--
-- Problem: notification settings (notify, unlockOffsetMinutes, titles, bodies)
-- were stored inside stories.days (mixed with story content). Every publish
-- created a fresh row from the admin draft — which has no notification fields —
-- wiping all config.
--
-- Solution:
--   1. A permanent `notification_config` table holds per-envelope settings.
--      The publish flow never touches this table.
--   2. A BEFORE INSERT/UPDATE trigger automatically merges config from this
--      table into any story row being published (is_published = true).
--      Config is injected at the DB level — no app code can accidentally skip it.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Notification config table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_config (
  envelope_id               TEXT        PRIMARY KEY,
  unlock_offset_minutes     INTEGER,
  notify                    BOOLEAN     NOT NULL DEFAULT false,
  notification_title        TEXT,
  notification_body         TEXT,
  reminder_title            TEXT,
  reminder_body             TEXT,
  reminder_interval_minutes INTEGER     DEFAULT 30,
  reminder_max_count        INTEGER     DEFAULT 0,
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Seed with current envelope config ──────────────────────────────────────
INSERT INTO notification_config
  (envelope_id, unlock_offset_minutes, notify,
   notification_title, notification_body,
   reminder_title, reminder_body,
   reminder_interval_minutes, reminder_max_count)
VALUES
  ('1A', NULL, true,
   'Something is waiting for you',
   'Good morning. Your first envelope is sealed and addressed to you — a mark you''ll wear for five days. Open it alone.',
   'Still waiting, love',
   'Your morning envelope hasn''t been opened yet. It''s patient — but it shouldn''t wait much longer.',
   30, 4),

  ('1B', 720, true,
   'Find somewhere soft tonight',
   'Evening, darling. The mark you chose this morning is against your skin. Now disappear somewhere quiet — couch, bed, or patio. A sealed letter is waiting for you.',
   'Your evening envelope is waiting',
   'Still haven''t opened it. Find a quiet corner and open your evening envelope — the story doesn''t begin without you.',
   30, 4),

  ('2A', 720, true,
   'A delivery arrived this morning',
   'Wake up, love. Flowers are waiting — and something else beneath them. Open the package alone, read the note carefully. Tonight has a specific time written into it.',
   'Don''t forget the morning package',
   'Your morning envelope is still sealed. There''s something inside you''ll need before tonight — open it before the day gets away from you.',
   30, 4),

  ('2B', 720, true,
   'Tonight''s instructions are ready',
   'You know what tonight is. What you chose this morning comes with a cost — and 9:00 PM is when you pay it. Open your evening envelope.',
   '9:00 PM is getting closer',
   'Your evening envelope still hasn''t been opened, and tonight has a deadline built in. Don''t let it pass.',
   30, 4),

  ('3A', 720, true,
   'One decision before your day starts',
   'Good morning, darling. Before anything else, there''s a single choice to make. It''s the last decision that belongs entirely to you today — take your time, you''ll be thinking about it all day.',
   'Make your choice while it''s still morning',
   'Your morning decision is still unmade. Whatever you pick will be waiting for you tonight — so choose now.',
   30, 4),

  ('3B', 720, true,
   'What you chose this morning is ready',
   'The restraints you picked are arranged. The blindfold is waiting. You already know what''s about to happen to you — open your evening envelope.',
   'Don''t keep the evening waiting',
   'Your evening envelope is still sealed. Everything from this morning has been prepared. Open it.',
   30, 4),

  ('4A', 720, true,
   'A package arrived at your door',
   'Open it alone. Read the note before you touch anything else. Today is different — you''re going somewhere, and how you look matters. Pack your bags.',
   'The morning package is still waiting',
   'Your morning envelope has a dress and a destination inside. Open it — today has a lot of hours in it, and you''ll want every one.',
   30, 4),

  ('4B', 720, true,
   'La Paloma is tonight',
   'You''re dressed, you''re stunning, and there''s one more thing before we leave. Nothing complicated — just your mouth on mine, for as long as you choose. Open the envelope.',
   'The evening''s first move is yours',
   'Your evening envelope has exactly one beautiful rule in it. Open it.',
   30, 4),

  ('5A', 720, true,
   'Last morning. One final choice.',
   'Five days comes down to tonight. You can surrender the ending completely — or design your perfect night yourself. Open your last morning envelope and choose wisely.',
   'Tonight is still unwritten',
   'Your final morning envelope is still sealed. Tonight is the last one — and how it ends depends entirely on what you decide right now.',
   30, 4),

  ('5B', 720, true,
   'No more holding back',
   'Everything you''ve been imagining since day one — it all happens tonight. Five days of waiting is over. Open your final envelope.',
   'The last envelope is waiting for you',
   'Your final evening envelope is still sealed. Everything you''ve earned over five days is behind that seal. Open it.',
   30, 4)

ON CONFLICT (envelope_id) DO UPDATE SET
  unlock_offset_minutes     = EXCLUDED.unlock_offset_minutes,
  notify                    = EXCLUDED.notify,
  notification_title        = EXCLUDED.notification_title,
  notification_body         = EXCLUDED.notification_body,
  reminder_title            = EXCLUDED.reminder_title,
  reminder_body             = EXCLUDED.reminder_body,
  reminder_interval_minutes = EXCLUDED.reminder_interval_minutes,
  reminder_max_count        = EXCLUDED.reminder_max_count,
  updated_at                = NOW();


-- ── 3. Trigger function ────────────────────────────────────────────────────────
-- Runs BEFORE INSERT OR UPDATE on stories.
-- When is_published = true, walks every envelope in days[] and overlays the
-- matching row from notification_config. Envelope content fields win over
-- config fields (so admin edits are never clobbered). scheduledAt is always
-- nulled out so stale absolute timestamps never survive a publish.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION apply_notification_config_to_published()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cfg         JSONB;
  new_days    JSONB := '[]'::jsonb;
  day_obj     JSONB;
  new_envs    JSONB;
  env_obj     JSONB;
  env_id      TEXT;
  env_cfg     JSONB;
  i           INT;
  j           INT;
BEGIN
  -- Only act when the row is being published
  IF NEW.is_published IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Build envelope_id → config map from notification_config table
  SELECT jsonb_object_agg(
    envelope_id,
    jsonb_build_object(
      'notify',                   notify,
      'notificationTitle',        notification_title,
      'notificationBody',         notification_body,
      'reminderTitle',            reminder_title,
      'reminderBody',             reminder_body,
      'reminderIntervalMinutes',  reminder_interval_minutes,
      'reminderMaxCount',         reminder_max_count,
      'unlockOffsetMinutes',      unlock_offset_minutes
    )
  )
  INTO cfg
  FROM notification_config;

  -- Walk every day → every envelope
  FOR i IN 0 .. jsonb_array_length(NEW.days) - 1 LOOP
    day_obj  := NEW.days -> i;
    new_envs := '[]'::jsonb;

    FOR j IN 0 .. jsonb_array_length(day_obj -> 'envelopes') - 1 LOOP
      env_obj := day_obj -> 'envelopes' -> j;
      env_id  := env_obj ->> 'id';
      env_cfg := cfg -> env_id;

      IF env_cfg IS NOT NULL THEN
        -- cfg is the base; env_obj fields win; scheduledAt always null
        env_obj := env_cfg || env_obj || '{"scheduledAt": null}'::jsonb;
      ELSE
        env_obj := env_obj || '{"scheduledAt": null}'::jsonb;
      END IF;

      new_envs := new_envs || jsonb_build_array(env_obj);
    END LOOP;

    new_days := new_days || jsonb_build_array(
      jsonb_set(day_obj, '{envelopes}', new_envs)
    );
  END LOOP;

  NEW.days := new_days;
  RETURN NEW;
END;
$$;

-- Idempotent: drop and recreate
DROP TRIGGER IF EXISTS trg_apply_notification_config ON stories;

CREATE TRIGGER trg_apply_notification_config
  BEFORE INSERT OR UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION apply_notification_config_to_published();

-- ── 4. Apply to current published story immediately ───────────────────────────
UPDATE stories
SET updated_at = NOW()
WHERE is_published = true;
