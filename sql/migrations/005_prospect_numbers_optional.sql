-- Make prospect number fields optional (emails no longer use them)
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS valid_proposals;
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS valid_deal_size;
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS valid_close_rate;

ALTER TABLE prospects
  ALTER COLUMN proposals_per_month DROP NOT NULL,
  ALTER COLUMN avg_deal_size DROP NOT NULL,
  ALTER COLUMN close_rate DROP NOT NULL,
  ALTER COLUMN time_to_cash_days DROP NOT NULL;

ALTER TABLE prospects
  ADD CONSTRAINT valid_proposals CHECK (proposals_per_month IS NULL OR proposals_per_month > 0),
  ADD CONSTRAINT valid_deal_size CHECK (avg_deal_size IS NULL OR avg_deal_size > 0),
  ADD CONSTRAINT valid_close_rate CHECK (close_rate IS NULL OR (close_rate >= 0 AND close_rate <= 100)),
  ADD CONSTRAINT valid_time_to_cash CHECK (time_to_cash_days IS NULL OR time_to_cash_days > 0);
