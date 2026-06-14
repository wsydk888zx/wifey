-- ─────────────────────────────────────────────────────────────────────────────
-- Honor admin-set scheduledAt instead of nulling it.
--
-- The previous trigger (20260606_notification_config_table.sql) merged
-- notification_config into published stories — which we keep — but ALSO
-- nulled `scheduledAt` on every envelope. That silently discarded whatever
-- absolute clock-time the admin set in the "Notification Time" field, and
-- forced the edge function to fall back to pace-adaptive offsets.
--
-- This migration recreates the trigger function WITHOUT the scheduledAt
-- nulling. Everything else (config merge, content-field precedence) is
-- unchanged. The edge function update in this same change is what actually
-- reads scheduledAt and fires at that absolute time.
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
  IF NEW.is_published IS NOT TRUE THEN
    RETURN NEW;
  END IF;

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

  FOR i IN 0 .. jsonb_array_length(NEW.days) - 1 LOOP
    day_obj  := NEW.days -> i;
    new_envs := '[]'::jsonb;

    FOR j IN 0 .. jsonb_array_length(day_obj -> 'envelopes') - 1 LOOP
      env_obj := day_obj -> 'envelopes' -> j;
      env_id  := env_obj ->> 'id';
      env_cfg := cfg -> env_id;

      IF env_cfg IS NOT NULL THEN
        -- cfg is the base; envelope fields (including scheduledAt) win.
        env_obj := env_cfg || env_obj;
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
