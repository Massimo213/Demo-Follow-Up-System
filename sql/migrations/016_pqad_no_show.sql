-- PQAD: add no_show verdict — prospect did not attend, PQAD cannot be determined

ALTER TABLE demos DROP CONSTRAINT IF EXISTS demos_pqad_verdict_valid;

ALTER TABLE demos
  ADD CONSTRAINT demos_pqad_verdict_valid
  CHECK (pqad_verdict IN ('pending', 'yes', 'no', 'no_show'));

COMMENT ON COLUMN demos.pqad_verdict IS 'pending | yes | no | no_show — Per Qualified Attended Demo';
