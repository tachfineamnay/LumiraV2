-- CreateEnum
CREATE TYPE "AnalyticsDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "analyticsConsentGranted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ga4ClientId" TEXT,
ADD COLUMN     "ga4SessionId" TEXT,
ADD COLUMN     "ga4ContextCapturedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AnalyticsDelivery" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ga4',
    "eventName" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orderId" TEXT,
    "clientId" TEXT,
    "sessionId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "AnalyticsDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "skippedReason" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDelivery_eventKey_key" ON "AnalyticsDelivery"("eventKey");

-- CreateIndex
CREATE INDEX "AnalyticsDelivery_status_nextAttemptAt_idx" ON "AnalyticsDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AnalyticsDelivery_transactionId_idx" ON "AnalyticsDelivery"("transactionId");

-- CreateIndex
CREATE INDEX "AnalyticsDelivery_orderId_idx" ON "AnalyticsDelivery"("orderId");
