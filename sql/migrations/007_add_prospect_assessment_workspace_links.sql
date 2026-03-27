-- Per-prospect links for Day 1 email (fallbacks can be set via env on app side)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS assessment_link TEXT,
  ADD COLUMN IF NOT EXISTS workspace_link TEXT;
