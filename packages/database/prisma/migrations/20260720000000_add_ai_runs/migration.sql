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
