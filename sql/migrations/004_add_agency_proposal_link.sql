-- Add agency proposal link for Touch 2 (one-proposal test)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS agency_proposal_link TEXT;
