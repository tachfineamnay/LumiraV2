-- Passwordless Sanctuaire links are stored as one-way hashes and consumed once.
CREATE TABLE "SanctuaireLoginToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SanctuaireLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SanctuaireLoginToken_tokenHash_key" ON "SanctuaireLoginToken"("tokenHash");
CREATE INDEX "SanctuaireLoginToken_userId_expiresAt_idx" ON "SanctuaireLoginToken"("userId", "expiresAt");
CREATE INDEX "SanctuaireLoginToken_expiresAt_idx" ON "SanctuaireLoginToken"("expiresAt");

ALTER TABLE "SanctuaireLoginToken"
  ADD CONSTRAINT "SanctuaireLoginToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
