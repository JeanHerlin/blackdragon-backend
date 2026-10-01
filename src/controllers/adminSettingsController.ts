import asyncHandler from '../utils/asyncHandler';
import * as settingsService from '../services/settingsService';

export const getSettings = asyncHandler(async (req, res) => {
  res.json(await settingsService.getSettings());
});

export const updateExchangeRate = asyncHandler(async (req, res) => {
  res.json(await settingsService.updateUsdToArRate(req.body.usdToArRate));
});

export const updateAdminStatus = asyncHandler(async (req, res) => {
  res.json(await settingsService.updateAdminActive(req.body.isAdminActive));
});
