-- AlterTable: add indexes present in schema.prisma but missing from initial migration

CREATE INDEX IF NOT EXISTS "User_subscriptionStatus_idx" ON "User"("subscriptionStatus");

CREATE INDEX IF NOT EXISTS "Order_userId_status_idx" ON "Order"("userId", "status");

CREATE INDEX IF NOT EXISTS "Order_userId_status_createdAt_idx" ON "Order"("userId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Order_status_updatedAt_idx" ON "Order"("status", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Order_userEmail_status_paidAt_idx" ON "Order"("userEmail", "status", "paidAt" DESC);
