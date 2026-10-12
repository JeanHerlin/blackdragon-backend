ALTER TABLE "Payment" ADD COLUMN "senderPhone" TEXT;
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "proofImageUrl" TEXT;

CREATE TABLE "PaymentProofToken" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentProofToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProofToken_orderId_key" ON "PaymentProofToken"("orderId");
CREATE UNIQUE INDEX "PaymentProofToken_tokenHash_key" ON "PaymentProofToken"("tokenHash");

ALTER TABLE "PaymentProofToken" ADD CONSTRAINT "PaymentProofToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountCredential" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'facebook';
