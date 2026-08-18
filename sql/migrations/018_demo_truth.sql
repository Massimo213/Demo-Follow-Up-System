-- 018_demo_truth.sql
-- Attendance + ingest instrumentation so show rate is computable.

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS horizon_hours DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ingest_path TEXT,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

ALTER TABLE demos DROP CONSTRAINT IF EXISTS demos_ingest_path_valid;
ALTER TABLE demos
  ADD CONSTRAINT demos_ingest_path_valid
  CHECK (ingest_path IS NULL OR ingest_path IN ('webhook', 'sync', 'test', 'unknown'));

COMMENT ON COLUMN demos.horizon_hours IS 'Hours from ingest (created_at) to scheduled_at — classification audit';
COMMENT ON COLUMN demos.ingest_path IS 'webhook | sync | test | unknown';
COMMENT ON COLUMN demos.phone_e164 IS 'Normalized E.164 from Calendly phone / Q&A';

CREATE INDEX IF NOT EXISTS idx_demos_status_scheduled
  ON demos(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_demos_phone_e164
  ON demos(phone_e164)
  WHERE phone_e164 IS NOT NULL;

-- Historical horizon from created_at → scheduled_at
UPDATE demos
SET horizon_hours = EXTRACT(EPOCH FROM (scheduled_at - created_at)) / 3600.0
WHERE horizon_hours IS NULL;

UPDATE demos
SET ingest_path = 'unknown'
WHERE ingest_path IS NULL;
