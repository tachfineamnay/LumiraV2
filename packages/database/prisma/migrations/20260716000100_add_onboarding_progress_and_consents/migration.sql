CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "data" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsentRecord_userId_purpose_version_key" ON "ConsentRecord"("userId", "purpose", "version");
CREATE INDEX "ConsentRecord_userId_acceptedAt_idx" ON "ConsentRecord"("userId", "acceptedAt" DESC);
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");
CREATE INDEX "OnboardingProgress_status_updatedAt_idx" ON "OnboardingProgress"("status", "updatedAt" DESC);

ALTER TABLE "ConsentRecord"
  ADD CONSTRAINT "ConsentRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingProgress"
  ADD CONSTRAINT "OnboardingProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
