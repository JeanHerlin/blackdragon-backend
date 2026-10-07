import asyncHandler from '../utils/asyncHandler';
import * as statsService from '../services/statsService';

const VALID_RANGES = ['today', '7d', 'month'];

export const getDashboardStats = asyncHandler(async (req, res) => {
  const range = VALID_RANGES.includes(req.query.range as string) ? (req.query.range as 'today' | '7d' | 'month') : 'today';
  res.json(await statsService.getDashboardStats(range));
});
