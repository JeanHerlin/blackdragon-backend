import asyncHandler from '../utils/asyncHandler';
import * as catalogService from '../services/catalogService';
import * as settingsService from '../services/settingsService';

export const listProductsGrouped = asyncHandler(async (req, res) => {
  const [categories, settings] = await Promise.all([
    catalogService.listAllProductsGroupedByCategory(),
    settingsService.getSettings(),
  ]);
  res.json({ usdToArRate: settings.usdToArRate, isAdminActive: settings.isAdminActive, categories });
});

export const updatePrice = asyncHandler(async (req, res) => {
  res.json(await catalogService.updateProductPrice(req.params.id, req.body.salePrice));
});
