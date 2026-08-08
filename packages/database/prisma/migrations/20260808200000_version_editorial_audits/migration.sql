-- Add audit provenance without rewriting existing articles. They are populated
-- on the next relevant save, publication, or explicit manual recalculation.
ALTER TABLE "EditorialArticle"
  ADD COLUMN "auditRuleVersion" TEXT,
  ADD COLUMN "auditInputHash" TEXT,
  ADD COLUMN "searchModifiedAt" TIMESTAMP(3);
