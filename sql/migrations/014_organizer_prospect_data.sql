-- Organizer UI: proposals/mo, avg deal size, close rate per demo (editable like notes)
ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS proposals_per_month INTEGER,
  ADD COLUMN IF NOT EXISTS avg_deal_size INTEGER,
  ADD COLUMN IF NOT EXISTS close_rate NUMERIC(5,2);

ALTER TABLE demos
  DROP CONSTRAINT IF EXISTS demos_valid_proposals,
  DROP CONSTRAINT IF EXISTS demos_valid_deal_size,
  DROP CONSTRAINT IF EXISTS demos_valid_close_rate;

ALTER TABLE demos
  ADD CONSTRAINT demos_valid_proposals CHECK (proposals_per_month IS NULL OR proposals_per_month > 0),
  ADD CONSTRAINT demos_valid_deal_size CHECK (avg_deal_size IS NULL OR avg_deal_size > 0),
  ADD CONSTRAINT demos_valid_close_rate CHECK (close_rate IS NULL OR (close_rate >= 0 AND close_rate <= 100));

COMMENT ON COLUMN demos.proposals_per_month IS 'Organizer-captured proposals sent per month';
COMMENT ON COLUMN demos.avg_deal_size IS 'Organizer-captured average deal size (USD)';
COMMENT ON COLUMN demos.close_rate IS 'Organizer-captured close rate (percent 0-100)';
