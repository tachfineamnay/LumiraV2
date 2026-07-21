-- Enrich the reading intake material collected from clients.
-- usageName: everyday first name / nickname used for name symbolism.
-- lifeEvents: free-text marking period or life event declared by the client.
-- lifeAreas: per-domain "life weather" JSON ({ relations|travail|corps|creativite|interieur|direction: { state, note? } }).
ALTER TABLE "UserProfile"
  ADD COLUMN "usageName" TEXT,
  ADD COLUMN "lifeEvents" TEXT,
  ADD COLUMN "lifeAreas" JSONB;
