-- ============================================
-- POST-DEMO FOLLOW-UP: Prospects Pipeline
-- Parallel to pre-demo system. Zero coupling.
-- ============================================

-- Prospect status
CREATE TYPE prospect_status AS ENUM ('ACTIVE', 'CLOSED_WON', 'CLOSED_LOST', 'PAUSED');

-- Objection categories
CREATE TYPE objection_type AS ENUM (
  'NEED_PARTNER_APPROVAL',
  'CHECKING_INTEGRATIONS',
  'REVIEWING_PIPELINE',
  'NEED_TIME_TO_THINK',
  'PRICE_CONCERN',
  'OTHER'
);

-- Post-demo message types (4-touch sequence)
CREATE TYPE prospect_message_type AS ENUM (
  'PD_RECAP_ROI',
  'PD_STAKEHOLDER_BRIEF',
  'PD_DIRECT_ASK',
  'PD_CLOSING_FILE'
);

-- ============================================
-- PROSPECTS TABLE
-- ============================================
CREATE TABLE prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  agency_name TEXT NOT NULL,
  
  -- Their metrics (the weapon)
  proposals_per_month INTEGER NOT NULL,
  avg_deal_size INTEGER NOT NULL,
  close_rate NUMERIC(5,2) NOT NULL,
  time_to_cash_days INTEGER NOT NULL,
  
  -- Context
  objection_type objection_type NOT NULL DEFAULT 'OTHER',
  notes TEXT,
  demo_date DATE NOT NULL,
  
  -- State
  status prospect_status NOT NULL DEFAULT 'ACTIVE',
  pricing_page_url TEXT NOT NULL DEFAULT 'https://elystra.com/pricing',
  agency_proposal_link TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_prospect_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_close_rate CHECK (close_rate >= 0 AND close_rate <= 100),
  CONSTRAINT valid_proposals CHECK (proposals_per_month > 0),
  CONSTRAINT valid_deal_size CHECK (avg_deal_size > 0)
);

CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_email ON prospects(email);

-- Auto-update updated_at
CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- PROSPECT_SCHEDULED_JOBS TABLE
-- ============================================
CREATE TABLE prospect_scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  
  message_type prospect_message_type NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  
  processing BOOLEAN NOT NULL DEFAULT FALSE,
  processing_started_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(prospect_id, message_type)
);

CREATE INDEX idx_prospect_jobs_pending 
  ON prospect_scheduled_jobs(executed, cancelled) 
  WHERE NOT executed AND NOT cancelled;

-- Atomic claim function for prospect jobs
CREATE OR REPLACE FUNCTION claim_prospect_job(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  claimed BOOLEAN;
BEGIN
  UPDATE prospect_scheduled_jobs
  SET processing = TRUE, processing_started_at = NOW()
  WHERE id = p_job_id
    AND executed = FALSE
    AND cancelled = FALSE
    AND processing = FALSE;
  
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END;
$$ LANGUAGE plpgsql;

-- Release stale prospect jobs (stuck > 5 min)
CREATE OR REPLACE FUNCTION release_stale_prospect_jobs()
RETURNS void AS $$
BEGIN
  UPDATE prospect_scheduled_jobs
  SET processing = FALSE, processing_started_at = NULL
  WHERE processing = TRUE
    AND processing_started_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PROSPECT_MESSAGES TABLE
-- ============================================
CREATE TABLE prospect_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  
  channel message_channel NOT NULL,
  message_type prospect_message_type NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  external_id TEXT,
  
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(prospect_id, message_type)
);

CREATE INDEX idx_prospect_messages_prospect ON prospect_messages(prospect_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on prospects" ON prospects
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on prospect_scheduled_jobs" ON prospect_scheduled_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on prospect_messages" ON prospect_messages
  FOR ALL USING (auth.role() = 'service_role');
