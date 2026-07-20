-- AI routing matrix + run telemetry (schema was missing from prior migrations).
CREATE TYPE "AiMission" AS ENUM (
  'DEFAULT',
  'READING_GENERATION',
  'TIMELINE_BATCH',
  'DREAM_INTERPRETATION',
  'CHAT_SESSION',
  'CONTENT_REFINEMENT',
  'AUDIO_NARRATION'
);

CREATE TABLE "AiRoutingRule" (
    "id" TEXT NOT NULL,
    "productLevel" "ProductLevel" NOT NULL,
    "agent" TEXT NOT NULL,
    "mission" "AiMission" NOT NULL DEFAULT 'DEFAULT',
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "maxTokens" INTEGER NOT NULL DEFAULT 16384,
    "promptVersionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRoutingRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiRoutingRule_productLevel_agent_mission_key" ON "AiRoutingRule"("productLevel", "agent", "mission");
CREATE INDEX "AiRoutingRule_productLevel_idx" ON "AiRoutingRule"("productLevel");
CREATE INDEX "AiRoutingRule_agent_idx" ON "AiRoutingRule"("agent");
CREATE INDEX "AiRoutingRule_isActive_idx" ON "AiRoutingRule"("isActive");

ALTER TABLE "AiRoutingRule" ADD CONSTRAINT "AiRoutingRule_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "agent" TEXT NOT NULL,
    "mission" "AiMission" NOT NULL,
    "productLevel" "ProductLevel",
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersionId" TEXT,
    "routingSource" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "status" "AiRunStatus" NOT NULL,
    "errorCode" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRun_orderId_idx" ON "AiRun"("orderId");

-- CreateIndex
CREATE INDEX "AiRun_agent_mission_idx" ON "AiRun"("agent", "mission");

-- CreateIndex
CREATE INDEX "AiRun_startedAt_idx" ON "AiRun"("startedAt" DESC);

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
