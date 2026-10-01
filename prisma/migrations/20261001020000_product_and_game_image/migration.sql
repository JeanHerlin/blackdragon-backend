-- AlterTable: one image per game (confirmed against g2bulk's public API — no per-item images)
ALTER TABLE "Game" ADD COLUMN "imageUrl" TEXT;

-- AlterTable: optional per-product override, used by manual "compte" products with no game default
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
