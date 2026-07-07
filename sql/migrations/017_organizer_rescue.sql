-- 017_organizer_rescue.sql
-- Demo Organizer: flag demos that need rescue / win-back attention.
-- Editable at any time and never blocked by pqad_locked.

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS is_rescue BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_demos_is_rescue ON demos(is_rescue) WHERE is_rescue = true;
