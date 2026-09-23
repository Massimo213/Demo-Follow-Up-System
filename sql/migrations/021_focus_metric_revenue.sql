-- Allow the third confirmation option (total revenue collected) to be stored.
ALTER TABLE demos DROP CONSTRAINT IF EXISTS focus_metric_valid_values;

ALTER TABLE demos
  ADD CONSTRAINT focus_metric_valid_values
  CHECK (
    focus_metric IS NULL
    OR focus_metric IN ('close_rate', 'deal_size', 'follow_up', 'revenue')
  );

COMMENT ON COLUMN demos.focus_metric IS
  'Focus metric captured from commitment ladder — close_rate, deal_size, follow_up, or revenue';
