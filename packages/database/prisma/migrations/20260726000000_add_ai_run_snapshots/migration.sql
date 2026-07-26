-- Preserve the resolved model contract and sanitized request shape for every
-- AI call. Existing runs remain valid with NULL snapshots.
ALTER TABLE "AiRun"
ADD COLUMN IF NOT EXISTS "executionSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "inputSnapshot" JSONB;
