-- Add SMS message types for post-demo 6-day touch model
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'prospect_message_type'
      AND e.enumlabel = 'PD_SMS_ASSESSMENT_WORKSPACE'
  ) THEN
    ALTER TYPE prospect_message_type ADD VALUE 'PD_SMS_ASSESSMENT_WORKSPACE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'prospect_message_type'
      AND e.enumlabel = 'PD_SMS_MISSED_CALL'
  ) THEN
    ALTER TYPE prospect_message_type ADD VALUE 'PD_SMS_MISSED_CALL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'prospect_message_type'
      AND e.enumlabel = 'PD_SMS_DECISION'
  ) THEN
    ALTER TYPE prospect_message_type ADD VALUE 'PD_SMS_DECISION';
  END IF;
END $$;
