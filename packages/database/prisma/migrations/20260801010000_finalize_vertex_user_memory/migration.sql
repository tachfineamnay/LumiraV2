-- Persist the intended remote mutation before Vertex is contacted. This lets a
-- retry converge after a provider success followed by a local database failure.
CREATE TYPE "MemoryMutationOperation" AS ENUM ('UPSERT', 'DELETE', 'SUPERSEDE');
CREATE TYPE "MemoryConflictResolution" AS ENUM ('KEEP_BOTH', 'SUPERSEDE');

ALTER TABLE "UserMemory"
  ADD COLUMN "pendingOperation" "MemoryMutationOperation",
  ADD COLUMN "conflictResolution" "MemoryConflictResolution",
  ADD COLUMN "conflictResolvedAt" TIMESTAMP(3),
  ADD COLUMN "conflictResolvedByExpertId" TEXT;

CREATE INDEX "UserMemory_pendingOperation_idx" ON "UserMemory"("pendingOperation");
