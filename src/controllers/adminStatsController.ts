import asyncHandler from '../utils/asyncHandler';
import * as statsService from '../services/statsService';

export const getDashboardStats = asyncHandler(async (req, res) => {
  res.json(await statsService.getDashboardStats());
});
