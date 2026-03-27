-- Add internal Day 2 call reminder for post-demo sequence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'prospect_message_type'
      AND e.enumlabel = 'PD_INTERNAL_CALL_REMINDER'
  ) THEN
    ALTER TYPE prospect_message_type ADD VALUE 'PD_INTERNAL_CALL_REMINDER';
  END IF;
END $$;
