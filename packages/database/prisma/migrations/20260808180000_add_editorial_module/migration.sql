-- CreateEnum
CREATE TYPE "EditorialArticleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EditorialInternalLinkStatus" AS ENUM ('SUGGESTED', 'ACTIVE', 'IGNORED');

-- CreateEnum
CREATE TYPE "EditorialPublicationEventType" AS ENUM ('SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'UNSCHEDULED', 'FAILED');

-- CreateTable
CREATE TABLE "EditorialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "family" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialTagAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialTagAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialArticleTag" (
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "EditorialArticleTag_pkey" PRIMARY KEY ("articleId","tagId")
);

-- CreateTable
CREATE TABLE "EditorialAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER NOT NULL,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentJson" JSONB NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "status" "EditorialArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "focusKeyword" TEXT,
    "canonical" TEXT,
    "seoScore" DOUBLE PRECISION,
    "aeoScore" DOUBLE PRECISION,
    "geoScore" DOUBLE PRECISION,
    "seoAudit" JSONB,
    "aeoAudit" JSONB,
    "geoAudit" JSONB,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "coverAssetId" TEXT,
    "authorId" TEXT,

    CONSTRAINT "EditorialArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialArticleLink" (
    "id" TEXT NOT NULL,
    "sourceArticleId" TEXT NOT NULL,
    "targetArticleId" TEXT NOT NULL,
    "anchorText" TEXT,
    "status" "EditorialInternalLinkStatus" NOT NULL DEFAULT 'SUGGESTED',
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialArticleLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EditorialArticleLink_source_target_distinct" CHECK ("sourceArticleId" <> "targetArticleId")
);

-- CreateTable
CREATE TABLE "EditorialPublicationEvent" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "EditorialPublicationEventType" NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialPublicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EditorialCategory_slug_key" ON "EditorialCategory"("slug");

-- CreateIndex
CREATE INDEX "EditorialCategory_isActive_idx" ON "EditorialCategory"("isActive");

-- CreateIndex
CREATE INDEX "EditorialCategory_sortOrder_idx" ON "EditorialCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialTag_slug_key" ON "EditorialTag"("slug");

-- CreateIndex
CREATE INDEX "EditorialTag_family_idx" ON "EditorialTag"("family");

-- CreateIndex
CREATE INDEX "EditorialTag_isActive_idx" ON "EditorialTag"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialTagAlias_alias_key" ON "EditorialTagAlias"("alias");

-- CreateIndex
CREATE INDEX "EditorialTagAlias_tagId_idx" ON "EditorialTagAlias"("tagId");

-- CreateIndex
CREATE INDEX "EditorialArticleTag_articleId_idx" ON "EditorialArticleTag"("articleId");

-- CreateIndex
CREATE INDEX "EditorialArticleTag_tagId_idx" ON "EditorialArticleTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialAsset_key_key" ON "EditorialAsset"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialArticle_slug_key" ON "EditorialArticle"("slug");

-- CreateIndex
CREATE INDEX "EditorialArticle_status_publishedAt_idx" ON "EditorialArticle"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "EditorialArticle_status_scheduledAt_idx" ON "EditorialArticle"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EditorialArticle_categoryId_publishedAt_idx" ON "EditorialArticle"("categoryId", "publishedAt");

-- CreateIndex
CREATE INDEX "EditorialArticle_featured_idx" ON "EditorialArticle"("featured");

-- CreateIndex
CREATE INDEX "EditorialArticle_createdAt_idx" ON "EditorialArticle"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "EditorialArticleLink_sourceArticleId_targetArticleId_key" ON "EditorialArticleLink"("sourceArticleId", "targetArticleId");

-- CreateIndex
CREATE INDEX "EditorialArticleLink_sourceArticleId_idx" ON "EditorialArticleLink"("sourceArticleId");

-- CreateIndex
CREATE INDEX "EditorialArticleLink_targetArticleId_idx" ON "EditorialArticleLink"("targetArticleId");

-- CreateIndex
CREATE INDEX "EditorialArticleLink_status_idx" ON "EditorialArticleLink"("status");

-- CreateIndex
CREATE INDEX "EditorialPublicationEvent_articleId_idx" ON "EditorialPublicationEvent"("articleId");

-- CreateIndex
CREATE INDEX "EditorialPublicationEvent_articleId_createdAt_idx" ON "EditorialPublicationEvent"("articleId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EditorialPublicationEvent_scheduledFor_idx" ON "EditorialPublicationEvent"("scheduledFor");

-- AddForeignKey
ALTER TABLE "EditorialTagAlias" ADD CONSTRAINT "EditorialTagAlias_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "EditorialTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialArticleTag" ADD CONSTRAINT "EditorialArticleTag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "EditorialArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialArticleTag" ADD CONSTRAINT "EditorialArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "EditorialTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialArticle" ADD CONSTRAINT "EditorialArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EditorialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialArticle" ADD CONSTRAINT "EditorialArticle_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "EditorialAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialArticle" ADD CONSTRAINT "EditorialArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Expert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialArticleLink" ADD CONSTRAINT "EditorialArticleLink_sourceArticleId_fkey" FOREIGN KEY ("sourceArticleId") REFERENCES "EditorialArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialArticleLink" ADD CONSTRAINT "EditorialArticleLink_targetArticleId_fkey" FOREIGN KEY ("targetArticleId") REFERENCES "EditorialArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPublicationEvent" ADD CONSTRAINT "EditorialPublicationEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "EditorialArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
