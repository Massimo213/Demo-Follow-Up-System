-- Migration 013: Add focus_metric column to demos table
-- Stores the prospect's chosen focus metric from the commitment ladder
-- Values: 'close_rate', 'deal_size', 'follow_up', or NULL

ALTER TABLE demos
ADD COLUMN IF NOT EXISTS focus_metric TEXT;

-- Add a check constraint to ensure valid values
ALTER TABLE demos
ADD CONSTRAINT focus_metric_valid_values
CHECK (focus_metric IS NULL OR focus_metric IN ('close_rate', 'deal_size', 'follow_up'));

-- Comment for documentation
COMMENT ON COLUMN demos.focus_metric IS 'Focus metric captured from commitment ladder — close_rate, deal_size, or follow_up';
