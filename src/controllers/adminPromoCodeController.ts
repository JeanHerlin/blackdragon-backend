import asyncHandler from '../utils/asyncHandler';
import * as promoCodeService from '../services/promoCodeService';

export const list = asyncHandler(async (req, res) => {
  res.json(await promoCodeService.listPromoCodes());
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await promoCodeService.createPromoCode(req.body.code, req.body.title));
});

export const remove = asyncHandler(async (req, res) => {
  await promoCodeService.deletePromoCode(req.params.id);
  res.json({ ok: true });
});

export const setActive = asyncHandler(async (req, res) => {
  res.json(await promoCodeService.setPromoCodeActive(req.params.id, req.body.isActive));
});

export const attach = asyncHandler(async (req, res) => {
  const { productId, discountType, discountValue } = req.body;
  res.status(201).json(await promoCodeService.attachToProduct({ promoCodeId: req.params.id, productId, discountType, discountValue }));
});

export const detach = asyncHandler(async (req, res) => {
  await promoCodeService.detachFromProduct(req.params.id, req.params.productId);
  res.json({ ok: true });
});
