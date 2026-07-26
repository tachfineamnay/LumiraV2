-- Preserve the lineage between an immutable sealed reading, its reopened
-- editable projection, the source snapshot and a SCRIBE regeneration candidate.
ALTER TABLE "ReadingVersion" ADD COLUMN "parentVersionId" TEXT;

CREATE INDEX "ReadingVersion_parentVersionId_idx" ON "ReadingVersion"("parentVersionId");

ALTER TABLE "ReadingVersion"
  ADD CONSTRAINT "ReadingVersion_parentVersionId_fkey"
  FOREIGN KEY ("parentVersionId") REFERENCES "ReadingVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
