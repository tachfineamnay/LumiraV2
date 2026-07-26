-- A journey belongs to the immutable reading version that created it. Keeping
-- older rows unlinked preserves their completed steps and associated dreams.
ALTER TABLE "SpiritualPath" ADD COLUMN "readingVersionId" TEXT;

DROP INDEX IF EXISTS "SpiritualPath_userId_key";
CREATE UNIQUE INDEX "SpiritualPath_readingVersionId_key" ON "SpiritualPath"("readingVersionId");
CREATE INDEX "SpiritualPath_userId_createdAt_idx" ON "SpiritualPath"("userId", "createdAt" DESC);

ALTER TABLE "SpiritualPath"
  ADD CONSTRAINT "SpiritualPath_readingVersionId_fkey"
  FOREIGN KEY ("readingVersionId") REFERENCES "ReadingVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
