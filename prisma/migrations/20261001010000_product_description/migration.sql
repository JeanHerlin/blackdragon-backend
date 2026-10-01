-- AlterTable: freeform context for manually-added products (no g2bulk entry to read it from)
ALTER TABLE "Product" ADD COLUMN "description" TEXT;
