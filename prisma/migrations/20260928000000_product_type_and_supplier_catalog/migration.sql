-- CreateTable
CREATE TABLE "SupplierCatalogEntry" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT 'g2bulk',
    "region" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePriceUsd" DOUBLE PRECISION NOT NULL,
    "productType" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCatalogEntry_supplier_region_supplierRef_key" ON "SupplierCatalogEntry"("supplier", "region", "supplierRef");

-- AddForeignKey
ALTER TABLE "SupplierCatalogEntry" ADD CONSTRAINT "SupplierCatalogEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add productType with a temporary default so existing rows aren't rejected
ALTER TABLE "Product" ADD COLUMN "productType" TEXT NOT NULL DEFAULT 'recharge';
ALTER TABLE "Product" ALTER COLUMN "productType" DROP DEFAULT;

-- AlterTable: link products to the supplier catalog entry they were created from
ALTER TABLE "Product" ADD COLUMN "sourceCatalogEntryId" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_sourceCatalogEntryId_fkey" FOREIGN KEY ("sourceCatalogEntryId") REFERENCES "SupplierCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
