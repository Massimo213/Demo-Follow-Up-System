-- Verbatim answer to the pre-demo question.
-- Later messages quote this. The old focus_metric category is no longer what the copy uses.

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS focus_reply TEXT;

COMMENT ON COLUMN demos.focus_reply IS
  'Exact words the prospect replied with before the walkthrough. Quoted back in later messages.';
