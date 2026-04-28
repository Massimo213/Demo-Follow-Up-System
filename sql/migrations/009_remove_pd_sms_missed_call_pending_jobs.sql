-- Retired PD_SMS_MISSED_CALL from automation; cancel pending jobs.
UPDATE prospect_scheduled_jobs
SET
  cancelled = true,
  processing = false,
  processing_started_at = NULL
WHERE message_type::text = 'PD_SMS_MISSED_CALL'
  AND executed = false
  AND cancelled = false;
