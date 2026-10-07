ALTER TABLE "Product" ADD COLUMN "isBundle" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ProductBundleItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "catalogEntryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductBundleItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductBundleItem_productId_catalogEntryId_key" ON "ProductBundleItem"("productId", "catalogEntryId");

ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_catalogEntryId_fkey" FOREIGN KEY ("catalogEntryId") REFERENCES "SupplierCatalogEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "catalogEntryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_catalogEntryId_fkey" FOREIGN KEY ("catalogEntryId") REFERENCES "SupplierCatalogEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
