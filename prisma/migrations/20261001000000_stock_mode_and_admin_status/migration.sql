-- AlterTable: distinguish "unlimited" products from "limited stock, currently zero" (out of stock)
ALTER TABLE "Product" ADD COLUMN "stockMode" TEXT NOT NULL DEFAULT 'unlimited';

-- AlterTable: whether the admin is available to process manual "achat par compte" deliveries
ALTER TABLE "Settings" ADD COLUMN "isAdminActive" BOOLEAN NOT NULL DEFAULT true;
