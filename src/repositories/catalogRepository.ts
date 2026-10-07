import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

export function listActiveGames() {
  return prisma.game.findMany({ where: { isActive: true } });
}

export function findGameByCode(code: string) {
  return prisma.game.findUnique({ where: { code } });
}

export function listCategories(gameId: string) {
  return prisma.category.findMany({ where: { gameId } });
}

export function findCategoryByCode(gameId: string, code: string) {
  return prisma.category.findFirst({ where: { gameId, code } });
}

// Single active game today, so the category code alone is enough to resolve it — this
// still works unambiguously once a second game exists, it would just need a gameCode too.
export function findCategoryByCodeAnyGame(code: string) {
  return prisma.category.findFirst({
    where: { code },
    include: {
      game: true,
      products: { orderBy: { label: 'asc' }, include: { sourceCatalogEntry: true } },
    },
  });
}

// Entries the admin can still pick for this category — already-used ones are excluded
// per category (not globally), since the same g2bulk reference legitimately backs two
// different Products at two different prices under "uid" vs "compte" (see backoffice-ux
// skill) and each category must still see it as pickable until it uses it itself.
export function listAvailableSupplierEntries({
  gameId,
  region,
  productType,
  categoryId,
}: {
  gameId: string;
  region: string;
  productType?: string;
  categoryId: string;
}) {
  return prisma.supplierCatalogEntry.findMany({
    where: { gameId, region, productType, products: { none: { categoryId } } },
    orderBy: { basePriceUsd: 'asc' },
  });
}

export function findSupplierCatalogEntryById(id: string) {
  return prisma.supplierCatalogEntry.findUnique({ where: { id } });
}

// Every g2bulk entry across every synced region, each annotated with which
// categories have already turned it into a Product — powers the "Packs g2bulk"
// browser tab, which is cross-region/cross-category by design (unlike the per-category
// picker above).
export function listAllSupplierEntries(gameId: string) {
  return prisma.supplierCatalogEntry.findMany({
    where: { gameId },
    orderBy: [{ region: 'asc' }, { basePriceUsd: 'asc' }],
    include: { products: { select: { id: true, category: { select: { code: true, label: true } } } } },
  });
}

export function upsertSupplierCatalogEntry(data: {
  gameId: string;
  supplier: string;
  region: string;
  supplierRef: string;
  name: string;
  basePriceUsd: number;
  productType: string;
}) {
  return prisma.supplierCatalogEntry.upsert({
    where: { supplier_region_supplierRef: { supplier: data.supplier, region: data.region, supplierRef: data.supplierRef } },
    update: { name: data.name, basePriceUsd: data.basePriceUsd, isAvailable: true },
    create: data,
  });
}

// Called before re-upserting a region's fresh catalogue — whatever doesn't get flipped
// back to true in this same sync run genuinely isn't offered by g2bulk any more.
export function markRegionUnavailable(gameId: string, region: string) {
  return prisma.supplierCatalogEntry.updateMany({ where: { gameId, region }, data: { isAvailable: false } });
}

// Public-facing shape only — never basePriceUsd (our cost), externalRef, deliveryMode or
// sourceCatalogEntryId, none of which a customer or the bot should ever see.
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  label: true,
  description: true,
  imageUrl: true,
  productType: true,
  salePrice: true,
  stockMode: true,
  stockQty: true,
  category: { select: { code: true, label: true, requiresAccountCredentials: true } },
  game: { select: { code: true, imageUrl: true } },
} satisfies Prisma.ProductSelect;

export function listProducts({
  gameId,
  categoryId,
  productType,
  onlyActive = true,
}: {
  gameId?: string;
  categoryId?: string;
  productType?: string;
  onlyActive?: boolean;
}) {
  return prisma.product.findMany({
    where: {
      ...(gameId ? { gameId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(productType ? { productType } : {}),
      ...(onlyActive ? { isActive: true } : {}),
    },
    select: PUBLIC_PRODUCT_SELECT,
  });
}

// Powers the bot's second step (after picking "uid"/"compte"): which product families
// actually have active products right now, so it never offers an empty type to pick.
export function listProductTypes(categoryId: string) {
  return prisma.product
    .findMany({
      where: { categoryId, isActive: true },
      distinct: ['productType'],
      select: { productType: true },
    })
    .then((rows) => rows.map((r) => r.productType));
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id }, include: { category: true, game: true } });
}

export function updateProductSalePrice(id: string, salePrice: number) {
  return prisma.product.update({ where: { id }, data: { salePrice } });
}

export function createProduct(data: Prisma.ProductUncheckedCreateInput) {
  return prisma.product.create({ data });
}

// Bundle items are created in the same transaction as the Product — never a Product
// with isBundle=true but zero components, which would have nothing for delivery to do.
export function createBundleProduct(
  data: Prisma.ProductUncheckedCreateInput,
  items: { catalogEntryId: string; quantity: number; sortOrder: number }[],
) {
  return prisma.product.create({
    data: { ...data, isBundle: true, bundleItems: { create: items } },
    include: { bundleItems: { include: { catalogEntry: true } } },
  });
}

export function updateProduct(id: string, data: Prisma.ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data });
}

export function countOrdersForProduct(productId: string) {
  return prisma.order.count({ where: { productId } });
}

export function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}

export function findProductWithBundleItems(id: string) {
  return prisma.product.findUnique({ where: { id }, include: { bundleItems: { include: { catalogEntry: true } } } });
}

export function deleteBundleItem(id: string) {
  return prisma.productBundleItem.delete({ where: { id } });
}

// Grouped by category for the backoffice, per backoffice-ux skill — never a flat list,
// since the same pack can exist twice (uid vs compte) at different prices.
export async function listAllProductsGroupedByCategory() {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        orderBy: { label: 'asc' },
        include: { sourceCatalogEntry: true, bundleItems: { include: { catalogEntry: true }, orderBy: { sortOrder: 'asc' } } },
      },
      game: true,
    },
  });
  return categories;
}
