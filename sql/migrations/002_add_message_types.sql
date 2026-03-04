-- Migration: Add new message types for v3 scheduler
-- Run this in Supabase SQL Editor

-- Add CONFIRM_INITIAL_LOOM (ignore error if already exists)
DO $$
BEGIN
  ALTER TYPE message_type ADD VALUE 'CONFIRM_INITIAL_LOOM';
EXCEPTION
  WHEN duplicate_object THEN NULL; -- already exists
  WHEN undefined_object THEN RAISE NOTICE 'Run schema.sql first';
END;
$$;
