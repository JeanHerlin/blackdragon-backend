import crypto from 'crypto';
import type { Category } from '@prisma/client';
import AppError from '../utils/AppError';
import * as catalogRepository from '../repositories/catalogRepository';
import * as g2bulkCatalogSyncService from './g2bulkCatalogSyncService';

interface StockInput {
  stockMode: 'unlimited' | 'limited';
  stockQty?: number;
}

interface CreateProductInput extends StockInput {
  catalogEntryId: string;
  label?: string;
  productType?: string;
  salePrice: number;
  imageUrl?: string;
}

interface CreateManualProductInput extends StockInput {
  productType: string;
  label: string;
  description?: string;
  basePriceUsd: number;
  salePrice: number;
  imageUrl?: string;
}

interface UpdateProductInput extends StockInput {
  label: string;
  description?: string;
  salePrice: number;
  basePriceUsd?: number;
  isActive?: boolean;
  imageUrl?: string;
}

export function listActiveGames() {
  return catalogRepository.listActiveGames();
}

export async function listCategories(gameCode: string) {
  const game = await catalogRepository.findGameByCode(gameCode);
  if (!game) throw new AppError('Game not found', 404);
  return catalogRepository.listCategories(game.id);
}

export async function listProducts({
  gameCode,
  categoryCode,
  productType,
}: {
  gameCode: string;
  categoryCode?: string;
  productType?: string;
}) {
  const game = await catalogRepository.findGameByCode(gameCode);
  if (!game) throw new AppError('Game not found', 404);

  let categoryId: string | undefined;
  if (categoryCode) {
    const category = await catalogRepository.findCategoryByCode(game.id, categoryCode);
    if (!category) throw new AppError('Category not found', 404);
    categoryId = category.id;
  }

  return catalogRepository.listProducts({ gameId: game.id, categoryId, productType });
}

// Bot flow: pick a game -> pick a category (uid/compte) -> pick a type (recharge/
// abonnement/...) -> browse that type's catalogue. This powers the third step.
export async function listProductTypes({ gameCode, categoryCode }: { gameCode: string; categoryCode: string }) {
  const game = await catalogRepository.findGameByCode(gameCode);
  if (!game) throw new AppError('Game not found', 404);

  const category = await catalogRepository.findCategoryByCode(game.id, categoryCode);
  if (!category) throw new AppError('Category not found', 404);

  return catalogRepository.listProductTypes(category.id);
}

export async function getProductOrThrow(productId: string) {
  const product = await catalogRepository.findProductById(productId);
  if (!product || !product.isActive) throw new AppError('Product not found', 404);
  return product;
}

export function listAllProductsGroupedByCategory() {
  return catalogRepository.listAllProductsGroupedByCategory();
}

export async function updateProductPrice(productId: string, salePrice: number) {
  if (typeof salePrice !== 'number' || salePrice <= 0) {
    throw new AppError('salePrice must be a positive number', 400);
  }
  return catalogRepository.updateProductSalePrice(productId, salePrice);
}

export async function getCategoryByCode(code: string) {
  const category = await catalogRepository.findCategoryByCodeAnyGame(code);
  if (!category) throw new AppError('Category not found', 404);
  return category;
}

function assertValidStock({ stockMode, stockQty }: StockInput): void {
  if (!['unlimited', 'limited'].includes(stockMode)) {
    throw new AppError('stockMode must be "unlimited" or "limited"', 400);
  }
  if (stockMode === 'limited' && (!Number.isInteger(stockQty) || (stockQty as number) < 0)) {
    throw new AppError('stockQty must be a non-negative integer when stockMode is "limited"', 400);
  }
}

// Powers the "Packs g2bulk" tab: every synced entry across every region, each
// annotated with the category codes that already turned it into a Product.
export async function listAllSupplierEntries(gameCode: string) {
  const game = await catalogRepository.findGameByCode(gameCode);
  if (!game) throw new AppError('Game not found', 404);

  const entries = await catalogRepository.listAllSupplierEntries(game.id);
  return entries.map((entry) => ({
    ...entry,
    syncedCategories: entry.products.map((p) => p.category.code),
  }));
}

export async function syncSupplierCatalog(gameCode: string) {
  const game = await catalogRepository.findGameByCode(gameCode);
  if (!game) throw new AppError('Game not found', 404);

  return g2bulkCatalogSyncService.syncAllRegions(game.id);
}

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
  return catalogRepository.listAvailableSupplierEntries({ gameId, region, productType, categoryId });
}

// The admin never types a supplier reference by hand — they pick a real g2bulk catalogue
// entry (see SupplierCatalogEntry) and only supply the sale price + stock. This is what
// makes it structurally impossible to create a product with a made-up/mistyped g2bulk id,
// which is exactly the delivery-by-wrong-id failure mode the client wanted closed off.
export async function createProductFromCatalogEntry(category: Category, input: CreateProductInput) {
  const entry = await catalogRepository.findSupplierCatalogEntryById(input.catalogEntryId);
  if (!entry || entry.gameId !== category.gameId) {
    throw new AppError('Supplier catalog entry not found', 404);
  }

  if (typeof input.salePrice !== 'number' || input.salePrice <= 0) {
    throw new AppError('salePrice must be a positive number', 400);
  }
  assertValidStock(input);

  try {
    return await catalogRepository.createProduct({
      gameId: category.gameId,
      categoryId: category.id,
      label: input.label || entry.name,
      // g2bulk's own classification is only a default — the admin can list the exact
      // same supplier entry under a different type per category (see the "Packs
      // g2bulk" browser tab, which is where this override is actually offered).
      productType: input.productType || entry.productType,
      // Scoped per category: the same g2bulk reference can legitimately back two
      // Products (one per category) at two different prices — see backoffice-ux skill.
      externalRef: `g2bulk-${category.code}-${entry.region}-${entry.supplierRef}`,
      basePriceUsd: entry.basePriceUsd,
      salePrice: input.salePrice,
      imageUrl: input.imageUrl || null,
      stockMode: input.stockMode,
      stockQty: input.stockMode === 'limited' ? (input.stockQty as number) : 0,
      deliveryMode: category.requiresAccountCredentials ? 'manual' : 'auto_g2bulk',
      sourceCatalogEntryId: entry.id,
      isActive: true,
    });
  } catch (err: any) {
    if (err.code === 'P2002') throw new AppError('This supplier entry has already been added', 409);
    throw err;
  }
}

// For products with no real g2bulk catalogue entry behind them at all (confirmed against
// g2bulk's real API: it only ever carries plain diamond recharges and a handful of named
// subscriptions — never level-up packs or airdrops) — the admin enters cost/description
// themselves instead of being structurally prevented from typing them, the way the
// g2bulk-picker flow above prevents it. Valid for any category, "uid" included: UID
// subscription packs are just as manual/unverified as compte ones in reality.
export async function createManualProduct(category: Category, input: CreateManualProductInput) {
  if (!input.productType || typeof input.productType !== 'string') {
    throw new AppError('productType is required', 400);
  }
  if (!input.label || typeof input.label !== 'string') {
    throw new AppError('label is required', 400);
  }
  if (typeof input.basePriceUsd !== 'number' || input.basePriceUsd < 0) {
    throw new AppError('basePriceUsd must be a non-negative number', 400);
  }
  if (typeof input.salePrice !== 'number' || input.salePrice <= 0) {
    throw new AppError('salePrice must be a positive number', 400);
  }
  assertValidStock(input);

  return catalogRepository.createProduct({
    gameId: category.gameId,
    categoryId: category.id,
    label: input.label,
    description: input.description,
    imageUrl: input.imageUrl || null,
    productType: input.productType,
    externalRef: `manual-${category.code}-${crypto.randomUUID()}`,
    basePriceUsd: input.basePriceUsd,
    salePrice: input.salePrice,
    stockMode: input.stockMode,
    stockQty: input.stockMode === 'limited' ? (input.stockQty as number) : 0,
    deliveryMode: 'manual',
    sourceCatalogEntryId: null,
    isActive: true,
  });
}

export async function updateProduct(productId: string, input: UpdateProductInput) {
  if (!input.label || typeof input.label !== 'string') throw new AppError('label is required', 400);
  if (typeof input.salePrice !== 'number' || input.salePrice <= 0) {
    throw new AppError('salePrice must be a positive number', 400);
  }
  assertValidStock(input);

  const product = await catalogRepository.findProductById(productId);
  if (!product) throw new AppError('Product not found', 404);

  // basePriceUsd is only editable for products predating the catalog-picker flow
  // (sourceCatalogEntryId is null, i.e. an estimated/unverified cost) — once a product
  // is tied to a confirmed g2bulk entry, its cost must stay in sync with the supplier.
  const basePriceUsd =
    !product.sourceCatalogEntryId && typeof input.basePriceUsd === 'number' ? input.basePriceUsd : undefined;

  return catalogRepository.updateProduct(productId, {
    label: input.label,
    description: input.description,
    // Empty string means "clear the override and fall back to the game's image" — stored as null.
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
    salePrice: input.salePrice,
    stockMode: input.stockMode,
    stockQty: input.stockMode === 'limited' ? (input.stockQty as number) : 0,
    isActive: input.isActive ?? true,
    ...(basePriceUsd !== undefined ? { basePriceUsd } : {}),
  });
}
