-- Versioned readings establish a single immutable source of truth for the
-- Studio → PDF → delivery flow. Existing generatedContent remains readable for
-- migration compatibility, but new deliveries must reference a SEALED row.
CREATE TYPE "ReadingVersionStatus" AS ENUM ('DRAFT', 'SEALED', 'REOPENED');

CREATE TABLE "ReadingVersion" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ReadingVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sealedByExpertId" TEXT,
    "sealedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReadingVersion_orderId_version_key" ON "ReadingVersion"("orderId", "version");
CREATE INDEX "ReadingVersion_orderId_status_version_idx" ON "ReadingVersion"("orderId", "status", "version" DESC);
CREATE INDEX "ReadingVersion_contentHash_idx" ON "ReadingVersion"("contentHash");

ALTER TABLE "ReadingVersion"
  ADD CONSTRAINT "ReadingVersion_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
