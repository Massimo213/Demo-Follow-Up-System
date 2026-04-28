-- SMS nudge 2h after PD_STAKEHOLDER_BRIEF email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'prospect_message_type'
      AND e.enumlabel = 'PD_SMS_STAKEHOLDER_FOLLOWUP'
  ) THEN
    ALTER TYPE prospect_message_type ADD VALUE 'PD_SMS_STAKEHOLDER_FOLLOWUP';
  END IF;
END $$;
