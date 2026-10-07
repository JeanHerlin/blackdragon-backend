import asyncHandler from '../utils/asyncHandler';
import * as pushService from '../services/pushService';

export const getPublicKey = asyncHandler(async (req, res) => {
  res.json({ publicKey: pushService.getPublicKey() });
});

export const subscribe = asyncHandler(async (req, res) => {
  await pushService.saveSubscription(req.body);
  res.status(201).json({ ok: true });
});

export const unsubscribe = asyncHandler(async (req, res) => {
  await pushService.removeSubscription(req.body.endpoint);
  res.json({ ok: true });
});
