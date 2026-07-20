-- Introduce an order-scoped onboarding source without removing the legacy
-- OnboardingProgress or Order.clientInputs storage. Existing orders remain
-- legacy-compatible (intakeRequired=false) unless a safe in-progress draft can
-- be attached unambiguously to their latest PAID order.

CREATE TYPE "ReadingIntakeStatus" AS ENUM ('DRAFT', 'SEALED');

ALTER TABLE "Order"
  ADD COLUMN "intakeRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReadingIntake" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReadingIntakeStatus" NOT NULL DEFAULT 'DRAFT',
    "schemaVersion" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT,
    "sealedAt" TIMESTAMP(3),
    "consentRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingIntake_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReadingIntake_currentStep_check" CHECK ("currentStep" BETWEEN 0 AND 4),
    CONSTRAINT "ReadingIntake_revision_check" CHECK ("revision" >= 0),
    CONSTRAINT "ReadingIntake_seal_consistency_check" CHECK (
      ("status" = 'DRAFT' AND "sealedAt" IS NULL AND "contentHash" IS NULL)
      OR
      ("status" = 'SEALED' AND "sealedAt" IS NOT NULL AND "contentHash" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "ReadingIntake_orderId_key" ON "ReadingIntake"("orderId");
CREATE INDEX "ReadingIntake_userId_status_updatedAt_idx"
  ON "ReadingIntake"("userId", "status", "updatedAt" DESC);
CREATE INDEX "ReadingIntake_status_updatedAt_idx"
  ON "ReadingIntake"("status", "updatedAt" DESC);
CREATE INDEX "ReadingIntake_contentHash_idx" ON "ReadingIntake"("contentHash");

ALTER TABLE "ReadingIntake"
  ADD CONSTRAINT "ReadingIntake_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingIntake"
  ADD CONSTRAINT "ReadingIntake_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingIntake"
  ADD CONSTRAINT "ReadingIntake_consentRecordId_fkey"
  FOREIGN KEY ("consentRecordId") REFERENCES "ConsentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill valid immutable snapshots. The legacy JSON remains untouched and is
-- still available to the compatibility resolver during the rollout.
INSERT INTO "ReadingIntake" (
  "id",
  "orderId",
  "userId",
  "status",
  "schemaVersion",
  "currentStep",
  "data",
  "revision",
  "contentHash",
  "sealedAt",
  "consentRecordId",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-sealed-' || md5(o."id"),
  o."id",
  o."userId",
  'SEALED'::"ReadingIntakeStatus",
  COALESCE(NULLIF(o."clientInputs"->'readingIntake'->>'version', ''), 'legacy-client-inputs-v1'),
  4,
  jsonb_strip_nulls(
    (o."clientInputs"->'readingIntake'->'profile' - 'facePhotoUrl' - 'palmPhotoUrl')
    || jsonb_build_object(
      'facePhoto', o."clientInputs"->'readingIntake'->'profile'->'facePhotoUrl',
      'palmPhoto', o."clientInputs"->'readingIntake'->'profile'->'palmPhotoUrl'
    )
  ),
  0,
  o."clientInputs"->'readingIntake'->>'contentHash',
  (o."clientInputs"->'readingIntake'->>'sealedAt')::timestamp(3),
  (
    SELECT c."id"
    FROM "ConsentRecord" c
    WHERE c."userId" = o."userId"
      AND c."purpose" = 'PERSONALIZED_SPIRITUAL_EXPERIENCE'
      AND c."version" = o."clientInputs"->'readingIntake'->>'consentVersion'
    ORDER BY c."acceptedAt" DESC
    LIMIT 1
  ),
  o."createdAt",
  o."updatedAt"
FROM "Order" o
WHERE jsonb_typeof(o."clientInputs"->'readingIntake') = 'object'
  AND jsonb_typeof(o."clientInputs"->'readingIntake'->'profile') = 'object'
  AND COALESCE(o."clientInputs"->'readingIntake'->>'sealedAt', '')
      ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
  AND COALESCE(o."clientInputs"->'readingIntake'->>'contentHash', '') <> ''
  AND COALESCE(o."clientInputs"->'readingIntake'->'profile'->>'birthDate', '') <> ''
  AND COALESCE(o."clientInputs"->'readingIntake'->'profile'->>'birthPlace', '') <> ''
ON CONFLICT ("orderId") DO NOTHING;

-- Backfill only a small, structurally safe draft onto the latest PAID order of
-- a user whose global profile is not already completed. Unknown legacy keys are
-- deliberately discarded instead of being copied into the strict payload.
WITH safe_drafts AS (
  SELECT DISTINCT ON (o."userId")
    o."id" AS "orderId",
    o."userId",
    p."currentStep",
    p."data",
    p."createdAt",
    p."updatedAt"
  FROM "Order" o
  JOIN "OnboardingProgress" p ON p."userId" = o."userId"
  LEFT JOIN "UserProfile" up ON up."userId" = o."userId"
  LEFT JOIN "ReadingIntake" ri ON ri."orderId" = o."id"
  WHERE o."status" = 'PAID'
    AND p."status" = 'IN_PROGRESS'
    AND COALESCE(up."profileCompleted", false) = false
    AND ri."id" IS NULL
    AND jsonb_typeof(p."data") = 'object'
    AND octet_length(p."data"::text) <= 32768
    AND (
      COALESCE(p."data"->>'facePhoto', p."data"->>'facePhotoUrl', '') = ''
      OR COALESCE(p."data"->>'facePhoto', p."data"->>'facePhotoUrl')
         LIKE 's3://onboarding/' || o."userId" || '/%'
    )
    AND (
      COALESCE(p."data"->>'palmPhoto', p."data"->>'palmPhotoUrl', '') = ''
      OR COALESCE(p."data"->>'palmPhoto', p."data"->>'palmPhotoUrl')
         LIKE 's3://onboarding/' || o."userId" || '/%'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(p."data" - 'consent') entry
      WHERE
        (entry.key = 'pace' AND jsonb_typeof(entry.value) <> 'number')
        OR
        (
          entry.key IN (
            'birthDate', 'birthTime', 'birthPlace', 'specificQuestion', 'objective',
            'facePhoto', 'palmPhoto', 'facePhotoUrl', 'palmPhotoUrl', 'highs', 'lows',
            'strongSide', 'weakSide', 'strongZone', 'weakZone', 'deliveryStyle',
            'ailments', 'fears', 'rituals'
          )
          AND jsonb_typeof(entry.value) <> 'string'
        )
    )
  ORDER BY o."userId", o."createdAt" DESC
)
INSERT INTO "ReadingIntake" (
  "id",
  "orderId",
  "userId",
  "status",
  "schemaVersion",
  "currentStep",
  "data",
  "revision",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-draft-' || md5(d."orderId"),
  d."orderId",
  d."userId",
  'DRAFT'::"ReadingIntakeStatus",
  '2026-07-20-order-intake-v1',
  LEAST(GREATEST(d."currentStep", 0), 4),
  jsonb_strip_nulls(jsonb_build_object(
    'birthDate', d."data"->'birthDate',
    'birthTime', d."data"->'birthTime',
    'birthPlace', d."data"->'birthPlace',
    'specificQuestion', d."data"->'specificQuestion',
    'objective', d."data"->'objective',
    'facePhoto', COALESCE(d."data"->'facePhoto', d."data"->'facePhotoUrl'),
    'palmPhoto', COALESCE(d."data"->'palmPhoto', d."data"->'palmPhotoUrl'),
    'highs', d."data"->'highs',
    'lows', d."data"->'lows',
    'strongSide', d."data"->'strongSide',
    'weakSide', d."data"->'weakSide',
    'strongZone', d."data"->'strongZone',
    'weakZone', d."data"->'weakZone',
    'deliveryStyle', d."data"->'deliveryStyle',
    'pace', d."data"->'pace',
    'ailments', d."data"->'ailments',
    'fears', d."data"->'fears',
    'rituals', d."data"->'rituals'
  )),
  0,
  d."createdAt",
  d."updatedAt"
FROM safe_drafts d
ON CONFLICT ("orderId") DO NOTHING;

UPDATE "Order" o
SET "intakeRequired" = true
FROM "ReadingIntake" ri
WHERE ri."orderId" = o."id"
  AND ri."status" = 'DRAFT';

