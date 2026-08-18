-- Phase 0 hardening: phone_e164 backfill, internal test tagging, horizon immutability

-- Backfill E.164 where phone is already +1XXXXXXXXXX (10–15 digits after +)
UPDATE demos
SET phone_e164 = regexp_replace(phone, '[^0-9+]', '', 'g')
WHERE phone_e164 IS NULL
  AND phone IS NOT NULL
  AND regexp_replace(phone, '[^0-9+]', '', 'g') ~ '^\+[1-9][0-9]{9,14}$';

-- US 10-digit numbers without country code → +1
UPDATE demos
SET phone_e164 = '+1' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone_e164 IS NULL
  AND phone IS NOT NULL
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10;

-- Tag known internal / QA rows so analytics exclusion is explicit in DB
UPDATE demos
SET ingest_path = 'test'
WHERE ingest_path IS DISTINCT FROM 'test'
  AND (
    calendly_event_id LIKE 'test-%'
    OR lower(email) LIKE '%testprospect%'
    OR lower(email) = 'elystrahelpmeteam@gmail.com'
    OR lower(email) LIKE '%@elystra.online'
  );

-- horizon_hours is set once at insert; sync must not silently reclassify buckets
CREATE OR REPLACE FUNCTION demos_preserve_horizon_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.horizon_hours IS NOT NULL AND NEW.horizon_hours IS DISTINCT FROM OLD.horizon_hours THEN
    NEW.horizon_hours := OLD.horizon_hours;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_demos_preserve_horizon_hours ON demos;
CREATE TRIGGER trg_demos_preserve_horizon_hours
  BEFORE UPDATE ON demos
  FOR EACH ROW
  EXECUTE FUNCTION demos_preserve_horizon_hours();
