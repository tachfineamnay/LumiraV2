CREATE TYPE "MemorySourceType" AS ENUM ('CLIENT_DECLARATION', 'SEALED_READING', 'EXPERT_CORRECTION', 'CHAT', 'DREAM', 'SYSTEM');
CREATE TYPE "UserMemoryStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUPERSEDED', 'DELETED', 'SYNC_FAILED');
CREATE TYPE "MemorySyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

ALTER TYPE "AiMission" ADD VALUE IF NOT EXISTS 'MEMORY_EXTRACTION';

CREATE TABLE "UserMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceType" "MemorySourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceVersionId" TEXT,
  "category" TEXT NOT NULL,
  "fact" TEXT NOT NULL,
  "status" "UserMemoryStatus" NOT NULL DEFAULT 'PENDING',
  "contentHash" TEXT NOT NULL,
  "vertexMemoryName" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "approvedByExpertId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemorySyncJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "readingVersionId" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "status" "MemorySyncJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "payload" JSONB,
  "result" JSONB,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemorySyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMemory_userId_contentHash_key" ON "UserMemory"("userId", "contentHash");
CREATE UNIQUE INDEX "UserMemory_vertexMemoryName_key" ON "UserMemory"("vertexMemoryName");
CREATE INDEX "UserMemory_userId_status_idx" ON "UserMemory"("userId", "status");
CREATE INDEX "UserMemory_sourceType_sourceId_idx" ON "UserMemory"("sourceType", "sourceId");
CREATE INDEX "UserMemory_sourceVersionId_idx" ON "UserMemory"("sourceVersionId");
CREATE INDEX "UserMemory_createdAt_idx" ON "UserMemory"("createdAt" DESC);
CREATE UNIQUE INDEX "MemorySyncJob_readingVersionId_key" ON "MemorySyncJob"("readingVersionId");
CREATE INDEX "MemorySyncJob_status_nextAttemptAt_idx" ON "MemorySyncJob"("status", "nextAttemptAt");
CREATE INDEX "MemorySyncJob_userId_idx" ON "MemorySyncJob"("userId");
CREATE INDEX "MemorySyncJob_orderId_idx" ON "MemorySyncJob"("orderId");

ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "ReadingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemorySyncJob" ADD CONSTRAINT "MemorySyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemorySyncJob" ADD CONSTRAINT "MemorySyncJob_readingVersionId_fkey" FOREIGN KEY ("readingVersionId") REFERENCES "ReadingVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
