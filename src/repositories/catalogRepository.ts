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

export function listProducts({
  gameId,
  categoryId,
  onlyActive = true,
}: {
  gameId?: string;
  categoryId?: string;
  onlyActive?: boolean;
}) {
  return prisma.product.findMany({
    where: {
      ...(gameId ? { gameId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(onlyActive ? { isActive: true } : {}),
    },
    include: { category: true },
  });
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

export function updateProduct(id: string, data: Prisma.ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data });
}

// Grouped by category for the backoffice, per backoffice-ux skill — never a flat list,
// since the same pack can exist twice (uid vs compte) at different prices.
export async function listAllProductsGroupedByCategory() {
  const categories = await prisma.category.findMany({
    include: {
      products: { orderBy: { label: 'asc' }, include: { sourceCatalogEntry: true } },
      game: true,
    },
  });
  return categories;
}
