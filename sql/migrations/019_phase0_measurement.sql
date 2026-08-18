-- 019_phase0_measurement.sql
-- Phase 0: attendance timestamps, ingest lag, phone validity, lead source.
-- Backfill: past PENDING/CONFIRMED with no joined_at → NO_SHOW.

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingest_lag_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lead_source TEXT;

COMMENT ON COLUMN demos.no_show_at IS 'When auto-NO_SHOW fired or organizer marked no-show';
COMMENT ON COLUMN demos.ingest_lag_seconds IS 'Seconds between Calendly invitee created_at and row insert';
COMMENT ON COLUMN demos.phone_valid IS 'False after Twilio invalid-To (21614/21211)';
COMMENT ON COLUMN demos.lead_source IS 'Calendly UTM source or manual';

-- Keep ingest_path values used in code
ALTER TABLE demos DROP CONSTRAINT IF EXISTS demos_ingest_path_valid;
ALTER TABLE demos
  ADD CONSTRAINT demos_ingest_path_valid
  CHECK (ingest_path IS NULL OR ingest_path IN ('webhook', 'sync', 'test', 'unknown'));

-- Backfill horizon if 018 was not applied
ALTER TABLE demos ADD COLUMN IF NOT EXISTS horizon_hours DOUBLE PRECISION;
ALTER TABLE demos ADD COLUMN IF NOT EXISTS ingest_path TEXT;
ALTER TABLE demos ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

UPDATE demos
SET horizon_hours = EXTRACT(EPOCH FROM (scheduled_at - created_at)) / 3600.0
WHERE horizon_hours IS NULL;

UPDATE demos
SET ingest_path = 'unknown'
WHERE ingest_path IS NULL;

-- Historical unresolved past slots → NO_SHOW (does not touch CANCELLED / RESCHEDULED / COMPLETED)
UPDATE demos
SET
  status = 'NO_SHOW',
  no_show_at = COALESCE(no_show_at, NOW())
WHERE status IN ('PENDING', 'CONFIRMED')
  AND joined_at IS NULL
  AND scheduled_at < NOW() - INTERVAL '12 minutes';

CREATE INDEX IF NOT EXISTS idx_demos_auto_no_show
  ON demos(status, scheduled_at)
  WHERE joined_at IS NULL;
