-- Massimo-only personal notes per demo (organizer UI); independent of PQAD lock
ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS organizer_personal_notes TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN demos.organizer_personal_notes IS 'Private organizer notes — editable even when pqad_locked';
