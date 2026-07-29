-- Preserve one PaymentIntent per browser checkout attempt across retries and reloads.
ALTER TABLE "Order" ADD COLUMN "checkoutAttemptId" TEXT;

CREATE UNIQUE INDEX "Order_checkoutAttemptId_key" ON "Order"("checkoutAttemptId");
