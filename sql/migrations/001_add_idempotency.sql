-- Migration: Add idempotency constraints
-- Run this in Supabase SQL Editor

-- 1. Add unique constraint on messages to prevent duplicate sends
-- (demo_id + message_type should be unique)
ALTER TABLE messages 
ADD CONSTRAINT messages_demo_type_unique UNIQUE (demo_id, message_type);

-- 2. Add processing state to jobs to prevent race conditions
ALTER TABLE scheduled_jobs 
ADD COLUMN IF NOT EXISTS processing BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- 3. Create index for finding processing jobs (to detect stale locks)
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_processing 
ON scheduled_jobs(processing, processing_started_at) 
WHERE processing = TRUE;

-- 4. Function to atomically claim a job for processing
CREATE OR REPLACE FUNCTION claim_job(job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  claimed BOOLEAN;
BEGIN
  UPDATE scheduled_jobs
  SET processing = TRUE, processing_started_at = NOW()
  WHERE id = job_id 
    AND executed = FALSE 
    AND cancelled = FALSE 
    AND processing = FALSE
  RETURNING TRUE INTO claimed;
  
  RETURN COALESCE(claimed, FALSE);
END;
$$ LANGUAGE plpgsql;

-- 5. Function to release stale locks (jobs stuck processing for > 5 min)
CREATE OR REPLACE FUNCTION release_stale_jobs()
RETURNS INTEGER AS $$
DECLARE
  released INTEGER;
BEGIN
  UPDATE scheduled_jobs
  SET processing = FALSE, processing_started_at = NULL
  WHERE processing = TRUE 
    AND processing_started_at < NOW() - INTERVAL '5 minutes'
  RETURNING 1 INTO released;
  
  RETURN COALESCE(released, 0);
END;
$$ LANGUAGE plpgsql;

