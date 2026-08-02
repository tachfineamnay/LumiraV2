-- Additive-only migration for targeted post-delivery intake complements.
-- Existing ReadingIntake, ReadingVersion, DeliveryRecord, PDF/audio references
-- and historical client data are left untouched.

CREATE TABLE "ReadingIntakeAmendment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readingIntakeId" TEXT,
  "kind" TEXT NOT NULL,
  "requestedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "data" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "contentHash" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "requestedByExpertId" TEXT NOT NULL,
  "reviewedByExpertId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReadingIntakeAmendment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReadingIntakeAmendment_kind_check"
    CHECK ("kind" IN ('PALM_PHOTO')),
  CONSTRAINT "ReadingIntakeAmendment_status_check"
    CHECK ("status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT "ReadingIntakeAmendment_revision_check"
    CHECK ("revision" >= 0)
);

CREATE TABLE "ReadingInputSnapshot" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "baseIntakeId" TEXT,
  "revision" INTEGER NOT NULL,
  "parentSnapshotId" TEXT,
  "data" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "amendmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReadingInputSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReadingInputSnapshot_revision_check" CHECK ("revision" > 0)
);

ALTER TABLE "ReadingVersion"
  ADD COLUMN "inputSnapshotId" TEXT;

ALTER TABLE "ReadingIntakeAmendment"
  ADD CONSTRAINT "ReadingIntakeAmendment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadingIntakeAmendment"
  ADD CONSTRAINT "ReadingIntakeAmendment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadingIntakeAmendment"
  ADD CONSTRAINT "ReadingIntakeAmendment_readingIntakeId_fkey"
  FOREIGN KEY ("readingIntakeId") REFERENCES "ReadingIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReadingIntakeAmendment"
  ADD CONSTRAINT "ReadingIntakeAmendment_requestedByExpertId_fkey"
  FOREIGN KEY ("requestedByExpertId") REFERENCES "Expert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReadingIntakeAmendment"
  ADD CONSTRAINT "ReadingIntakeAmendment_reviewedByExpertId_fkey"
  FOREIGN KEY ("reviewedByExpertId") REFERENCES "Expert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReadingInputSnapshot"
  ADD CONSTRAINT "ReadingInputSnapshot_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadingInputSnapshot"
  ADD CONSTRAINT "ReadingInputSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadingInputSnapshot"
  ADD CONSTRAINT "ReadingInputSnapshot_baseIntakeId_fkey"
  FOREIGN KEY ("baseIntakeId") REFERENCES "ReadingIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReadingInputSnapshot"
  ADD CONSTRAINT "ReadingInputSnapshot_parentSnapshotId_fkey"
  FOREIGN KEY ("parentSnapshotId") REFERENCES "ReadingInputSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReadingVersion"
  ADD CONSTRAINT "ReadingVersion_inputSnapshotId_fkey"
  FOREIGN KEY ("inputSnapshotId") REFERENCES "ReadingInputSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ReadingIntakeAmendment_orderId_status_idx"
  ON "ReadingIntakeAmendment"("orderId", "status", "updatedAt" DESC);
CREATE INDEX "ReadingIntakeAmendment_userId_status_idx"
  ON "ReadingIntakeAmendment"("userId", "status", "updatedAt" DESC);
CREATE INDEX "ReadingIntakeAmendment_expiresAt_idx"
  ON "ReadingIntakeAmendment"("expiresAt");
CREATE INDEX "ReadingIntakeAmendment_contentHash_idx"
  ON "ReadingIntakeAmendment"("contentHash");

-- One open request of a given kind per order. Expired rows are moved to
-- CANCELLED transactionally before a replacement request is created.
CREATE UNIQUE INDEX "ReadingIntakeAmendment_active_order_kind_key"
  ON "ReadingIntakeAmendment"("orderId", "kind")
  WHERE "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED');

CREATE UNIQUE INDEX "ReadingInputSnapshot_orderId_revision_key"
  ON "ReadingInputSnapshot"("orderId", "revision");
CREATE UNIQUE INDEX "ReadingInputSnapshot_orderId_contentHash_key"
  ON "ReadingInputSnapshot"("orderId", "contentHash");
CREATE INDEX "ReadingInputSnapshot_userId_createdAt_idx"
  ON "ReadingInputSnapshot"("userId", "createdAt" DESC);
CREATE INDEX "ReadingVersion_inputSnapshotId_idx"
  ON "ReadingVersion"("inputSnapshotId");

-- A retake can be requested after the original client deadline. Give the
-- client a complete seven-day window instead of cancelling the reopened task
-- on the next Sanctuaire read.
CREATE FUNCTION "extend_reading_amendment_retake_expiry"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'REQUESTED'
     AND OLD."status" IN ('SUBMITTED', 'REJECTED') THEN
    NEW."expiresAt" := GREATEST(
      NEW."expiresAt",
      CURRENT_TIMESTAMP + INTERVAL '7 days'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReadingIntakeAmendment_extend_retake_expiry"
BEFORE UPDATE OF "status" ON "ReadingIntakeAmendment"
FOR EACH ROW
EXECUTE FUNCTION "extend_reading_amendment_retake_expiry"();
