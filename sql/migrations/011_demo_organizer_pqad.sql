-- Demo organizer rail: who booked, PQAD verdict, payouts (Massimo-only surface)
-- Run after existing demos migrations.

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS organizer_booked_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pqad_verdict TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pqad_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS pqad_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sdr_payout_cents INTEGER,
  ADD COLUMN IF NOT EXISTS lieutenant_override_cents INTEGER,
  ADD COLUMN IF NOT EXISTS pqad_decided_at TIMESTAMPTZ;

ALTER TABLE demos DROP CONSTRAINT IF EXISTS demos_pqad_verdict_valid;

ALTER TABLE demos
  ADD CONSTRAINT demos_pqad_verdict_valid
  CHECK (pqad_verdict IN ('pending', 'yes', 'no'));

CREATE INDEX IF NOT EXISTS idx_demos_pqad_verdict ON demos(pqad_verdict);
CREATE INDEX IF NOT EXISTS idx_demos_scheduled_at_desc ON demos(scheduled_at DESC);

COMMENT ON COLUMN demos.organizer_booked_by IS 'SDR / booker attribution (single source of truth)';
COMMENT ON COLUMN demos.pqad_verdict IS 'pending | yes | no — Per Qualified Attended Demo';
COMMENT ON COLUMN demos.pqad_locked IS 'When true, verdict and payouts are immutable';
