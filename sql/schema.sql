-- ============================================
-- DEMO FOLLOWUP SYSTEM - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Demo type enum
CREATE TYPE demo_type AS ENUM ('SAME_DAY', 'NEXT_DAY', 'FUTURE');

-- Demo status state machine
CREATE TYPE demo_status AS ENUM (
  'PENDING',      -- Awaiting confirmation
  'CONFIRMED',    -- User replied YES
  'RESCHEDULED',  -- User requested reschedule
  'CANCELLED',    -- Demo cancelled
  'NO_SHOW',      -- User didn't join after demo time
  'COMPLETED'     -- Demo happened
);

-- Message channel
CREATE TYPE message_channel AS ENUM ('EMAIL', 'SMS');

-- Message type for tracking
CREATE TYPE message_type AS ENUM (
  'CONFIRM_INITIAL',
  'CONFIRM_REMINDER',
  'JOIN_LINK',
  'JOIN_URGENT',
  'SOONER_OFFER',
  'NO_CONFIRM_SMS',
  'RECEIPT'
);

-- ============================================
-- DEMOS TABLE - Core record
-- ============================================
CREATE TABLE demos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Calendly data
  calendly_event_id TEXT UNIQUE NOT NULL,
  calendly_invitee_id TEXT NOT NULL,
  
  -- Contact info
  email TEXT NOT NULL,
  phone TEXT,
  name TEXT NOT NULL,
  
  -- Demo details
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  demo_type demo_type NOT NULL,
  join_url TEXT NOT NULL,
  
  -- State
  status demo_status NOT NULL DEFAULT 'PENDING',
  confirmed_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes for common queries
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for finding demos by time range (for cron checks)
CREATE INDEX idx_demos_scheduled_at ON demos(scheduled_at);
CREATE INDEX idx_demos_status ON demos(status);
CREATE INDEX idx_demos_email ON demos(email);

-- ============================================
-- SCHEDULED_JOBS TABLE - Track queued jobs
-- ============================================
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_id UUID NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
  
  -- QStash message ID for deduplication/cancellation
  qstash_message_id TEXT UNIQUE,
  
  -- Job details
  message_type message_type NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  
  -- State
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate jobs
  UNIQUE(demo_id, message_type)
);

CREATE INDEX idx_scheduled_jobs_demo ON scheduled_jobs(demo_id);
CREATE INDEX idx_scheduled_jobs_pending ON scheduled_jobs(executed, cancelled) WHERE NOT executed AND NOT cancelled;

-- ============================================
-- MESSAGES TABLE - Audit log of all sent messages
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_id UUID NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
  
  -- Message details
  channel message_channel NOT NULL,
  message_type message_type NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  
  -- External IDs for tracking
  external_id TEXT, -- Resend/Twilio message ID
  
  -- Audit
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_demo ON messages(demo_id);

-- ============================================
-- REPLIES TABLE - Track inbound responses
-- ============================================
CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demo_id UUID REFERENCES demos(id) ON DELETE SET NULL,
  
  -- Reply details
  channel message_channel NOT NULL,
  from_address TEXT NOT NULL, -- email or phone
  body TEXT NOT NULL,
  
  -- Parsed intent
  intent TEXT, -- 'YES', 'RESCHEDULE', 'SOONER', '1', '2', 'UNKNOWN'
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Audit
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_replies_from ON replies(from_address);
CREATE INDEX idx_replies_unprocessed ON replies(processed) WHERE NOT processed;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER demos_updated_at
  BEFORE UPDATE ON demos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to classify demo type based on scheduled time
CREATE OR REPLACE FUNCTION classify_demo_type(scheduled TIMESTAMPTZ)
RETURNS demo_type AS $$
DECLARE
  hours_until_demo FLOAT;
BEGIN
  hours_until_demo := EXTRACT(EPOCH FROM (scheduled - NOW())) / 3600;
  
  IF hours_until_demo <= 12 THEN
    RETURN 'SAME_DAY';
  ELSIF hours_until_demo <= 36 THEN
    RETURN 'NEXT_DAY';
  ELSE
    RETURN 'FUTURE';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- ============================================
ALTER TABLE demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on demos" ON demos
  FOR ALL USING (auth.role() = 'service_role');
  
CREATE POLICY "Service role full access on scheduled_jobs" ON scheduled_jobs
  FOR ALL USING (auth.role() = 'service_role');
  
CREATE POLICY "Service role full access on messages" ON messages
  FOR ALL USING (auth.role() = 'service_role');
  
CREATE POLICY "Service role full access on replies" ON replies
  FOR ALL USING (auth.role() = 'service_role');

