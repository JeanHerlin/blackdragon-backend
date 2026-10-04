import asyncHandler from '../utils/asyncHandler';
import * as categoryDashboardService from '../services/categoryDashboardService';
import * as catalogService from '../services/catalogService';

// g2bulk's own code for this region — used when the per-category picker (not the
// cross-region "Packs g2bulk" tab) doesn't specify one explicitly.
const DEFAULT_SUPPLIER_REGION = 'freefire_me';

export const getDashboard = asyncHandler(async (req, res) => {
  res.json(await categoryDashboardService.getCategoryDashboard(req.params.categoryCode, req.query.date as string | undefined));
});

export const listSupplierOptions = asyncHandler(async (req, res) => {
  const category = await catalogService.getCategoryByCode(req.params.categoryCode);
  const entries = await catalogService.listAvailableSupplierEntries({
    gameId: category.gameId,
    region: (req.query.region as string) || DEFAULT_SUPPLIER_REGION,
    productType: req.query.productType as string | undefined,
    categoryId: category.id,
  });
  res.json(entries);
});

export const createProduct = asyncHandler(async (req, res) => {
  const category = await catalogService.getCategoryByCode(req.params.categoryCode);
  res.status(201).json(await catalogService.createProductFromCatalogEntry(category, req.body));
});

export const createManualProduct = asyncHandler(async (req, res) => {
  const category = await catalogService.getCategoryByCode(req.params.categoryCode);
  res.status(201).json(await catalogService.createManualProduct(category, req.body));
});

export const updateProduct = asyncHandler(async (req, res) => {
  res.json(await catalogService.updateProduct(req.params.productId, req.body));
});
