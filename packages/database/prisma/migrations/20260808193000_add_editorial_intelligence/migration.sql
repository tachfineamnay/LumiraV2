-- CreateEnum
CREATE TYPE "EditorialOpportunityStatus" AS ENUM ('NEW', 'SAVED', 'PLANNED', 'COVERED', 'IGNORED');

-- CreateEnum
CREATE TYPE "EditorialModelProfile" AS ENUM ('RESEARCH_FAST', 'RESEARCH_DEEP', 'SERP_ANALYSIS', 'LINKING', 'SEO_COPILOT');

-- CreateTable
CREATE TABLE "EditorialIntelligenceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "location" TEXT NOT NULL DEFAULT 'europe-west9',
    "authStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "vertexStatus" TEXT NOT NULL DEFAULT 'UNCHECKED',
    "models" JSONB NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "locale" TEXT NOT NULL DEFAULT 'fr-FR',
    "secondaryMarkets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groundingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "confidenceMinimum" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "opportunityWeights" JSONB NOT NULL,
    "opportunityScanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "opportunityScanFrequency" TEXT NOT NULL DEFAULT 'DAILY',
    "competitorScanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "competitorScanFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "performanceSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyCallLimit" INTEGER NOT NULL DEFAULT 100,
    "monthlyWarningThreshold" INTEGER NOT NULL DEFAULT 2000,
    "concurrencyLimit" INTEGER NOT NULL DEFAULT 5,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialIntelligenceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialCompetitor" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isTracked" BOOLEAN NOT NULL DEFAULT true,
    "targetKeywords" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialResearchQuery" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "inputHash" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,

    CONSTRAINT "EditorialResearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialOpportunity" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "slugCandidate" TEXT,
    "status" "EditorialOpportunityStatus" NOT NULL DEFAULT 'NEW',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "intentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weaknessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "demandScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topicalFitScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specificityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clusterGapScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inputHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,

    CONSTRAINT "EditorialOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialResearchSnapshot" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queryId" TEXT,
    "opportunityId" TEXT,

    CONSTRAINT "EditorialResearchSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialAiInsight" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "modelProfile" "EditorialModelProfile" NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialAiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleId" TEXT,

    CONSTRAINT "EditorialPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EditorialCompetitor_domain_key" ON "EditorialCompetitor"("domain");
CREATE INDEX "EditorialCompetitor_isTracked_idx" ON "EditorialCompetitor"("isTracked");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialResearchQuery_inputHash_key" ON "EditorialResearchQuery"("inputHash");
CREATE INDEX "EditorialResearchQuery_country_language_idx" ON "EditorialResearchQuery"("country", "language");
CREATE INDEX "EditorialResearchQuery_status_idx" ON "EditorialResearchQuery"("status");

-- CreateIndex
CREATE INDEX "EditorialOpportunity_status_score_idx" ON "EditorialOpportunity"("status", "score" DESC);
CREATE INDEX "EditorialOpportunity_categoryId_idx" ON "EditorialOpportunity"("categoryId");

-- CreateIndex
CREATE INDEX "EditorialResearchSnapshot_queryId_idx" ON "EditorialResearchSnapshot"("queryId");
CREATE INDEX "EditorialResearchSnapshot_opportunityId_idx" ON "EditorialResearchSnapshot"("opportunityId");
CREATE INDEX "EditorialResearchSnapshot_createdAt_idx" ON "EditorialResearchSnapshot"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "EditorialAiInsight_targetType_targetId_idx" ON "EditorialAiInsight"("targetType", "targetId");
CREATE INDEX "EditorialAiInsight_insightType_idx" ON "EditorialAiInsight"("insightType");
CREATE INDEX "EditorialAiInsight_createdAt_idx" ON "EditorialAiInsight"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "EditorialPerformanceSnapshot_articleId_idx" ON "EditorialPerformanceSnapshot"("articleId");
CREATE INDEX "EditorialPerformanceSnapshot_metricType_idx" ON "EditorialPerformanceSnapshot"("metricType");
CREATE INDEX "EditorialPerformanceSnapshot_createdAt_idx" ON "EditorialPerformanceSnapshot"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "EditorialResearchQuery" ADD CONSTRAINT "EditorialResearchQuery_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EditorialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialOpportunity" ADD CONSTRAINT "EditorialOpportunity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EditorialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialResearchSnapshot" ADD CONSTRAINT "EditorialResearchSnapshot_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "EditorialResearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialResearchSnapshot" ADD CONSTRAINT "EditorialResearchSnapshot_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "EditorialOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPerformanceSnapshot" ADD CONSTRAINT "EditorialPerformanceSnapshot_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "EditorialArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
