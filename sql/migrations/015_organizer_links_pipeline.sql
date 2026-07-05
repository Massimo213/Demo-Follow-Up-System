-- 015_organizer_links_pipeline.sql
-- Demo Organizer: assessment link, private workspace link, and pipeline stage tracking
-- These fields are editable at any time and never blocked by pqad_locked.

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS assessment_link TEXT,
  ADD COLUMN IF NOT EXISTS private_workspace_link TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'demo_done';

ALTER TABLE demos
  ADD CONSTRAINT demos_pipeline_stage_check
  CHECK (pipeline_stage IN (
    'demo_done',
    'assessment_sent',
    'proposal_sent',
    'negotiation',
    'closed_won',
    'closed_lost'
  ));

CREATE INDEX IF NOT EXISTS idx_demos_pipeline_stage ON demos(pipeline_stage);
