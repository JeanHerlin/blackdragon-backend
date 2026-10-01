-- Add basePriceUsd with a temporary default so existing rows aren't rejected,
-- then drop the default once every row is filled in by the reseed.
ALTER TABLE "Product" ADD COLUMN "basePriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Product" ALTER COLUMN "basePriceUsd" DROP DEFAULT;
ALTER TABLE "Product" DROP COLUMN "basePrice";

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "usdToArRate" DOUBLE PRECISION NOT NULL DEFAULT 4500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
