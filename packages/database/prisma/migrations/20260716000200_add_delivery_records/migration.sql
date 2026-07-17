CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

CREATE TABLE "DeliveryRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "readingVersionId" TEXT NOT NULL,
    "pdfKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "emailStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailSentAt" TIMESTAMP(3),
    "lastEmailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryRecord_orderId_readingVersionId_key" ON "DeliveryRecord"("orderId", "readingVersionId");
CREATE INDEX "DeliveryRecord_emailStatus_updatedAt_idx" ON "DeliveryRecord"("emailStatus", "updatedAt" DESC);
CREATE INDEX "DeliveryRecord_contentHash_idx" ON "DeliveryRecord"("contentHash");

ALTER TABLE "DeliveryRecord"
  ADD CONSTRAINT "DeliveryRecord_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryRecord"
  ADD CONSTRAINT "DeliveryRecord_readingVersionId_fkey"
  FOREIGN KEY ("readingVersionId") REFERENCES "ReadingVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
