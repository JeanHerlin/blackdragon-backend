import asyncHandler from '../utils/asyncHandler';
import * as settingsService from '../services/settingsService';
import { syncExchangeRateNow } from '../jobs/exchangeRateSyncJob';

export const getSettings = asyncHandler(async (req, res) => {
  res.json(await settingsService.getSettings());
});

// No manual rate entry — the admin can only trigger an immediate live sync (same fetch
// the 6h cron runs), never type an arbitrary value in.
export const syncExchangeRate = asyncHandler(async (req, res) => {
  res.json(await syncExchangeRateNow());
});

export const updateAdminStatus = asyncHandler(async (req, res) => {
  res.json(await settingsService.updateAdminActive(req.body.isAdminActive));
});
