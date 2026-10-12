import AppError from '../utils/AppError';
import * as promoCodeRepository from '../repositories/promoCodeRepository';
import * as catalogRepository from '../repositories/catalogRepository';

const DISCOUNT_TYPES = ['percent', 'fixed'];

export function listPromoCodes() {
  return promoCodeRepository.listAll();
}

// Codes are matched case-insensitively at checkout (see resolveDiscount) but stored
// uppercased so the admin list and the lookup are always comparing the same string.
// title is purely for the admin's own memory (never shown to the customer) — required
// so a list of codes doesn't turn into unreadable gibberish after a few dozen entries.
export async function createPromoCode(rawCode: string, rawTitle: string) {
  const code = rawCode.trim().toUpperCase();
  const title = rawTitle?.trim();
  if (!code) throw new AppError('Le code promo ne peut pas être vide', 400);
  if (!title) throw new AppError('Le titre du code promo ne peut pas être vide', 400);

  const existing = await promoCodeRepository.findByCode(code);
  if (existing) throw new AppError('Ce code promo existe déjà', 409);

  return promoCodeRepository.create(code, title);
}

export function deletePromoCode(id: string) {
  return promoCodeRepository.remove(id);
}

export function setPromoCodeActive(id: string, isActive: boolean) {
  return promoCodeRepository.setActive(id, isActive);
}

function assertValidDiscount(discountType: string, discountValue: number): void {
  if (!DISCOUNT_TYPES.includes(discountType)) throw new AppError('discountType must be "percent" or "fixed"', 400);
  if (typeof discountValue !== 'number' || discountValue <= 0) throw new AppError('discountValue must be a positive number', 400);
  if (discountType === 'percent' && discountValue > 100) throw new AppError('Une remise en pourcentage ne peut pas dépasser 100', 400);
}

export async function attachToProduct({
  promoCodeId,
  productId,
  discountType,
  discountValue,
}: {
  promoCodeId: string;
  productId: string;
  discountType: string;
  discountValue: number;
}) {
  assertValidDiscount(discountType, discountValue);

  const product = await catalogRepository.findProductById(productId);
  if (!product) throw new AppError('Product not found', 404);

  return promoCodeRepository.attachToProduct({ promoCodeId, productId, discountType, discountValue });
}

export function detachFromProduct(promoCodeId: string, productId: string) {
  return promoCodeRepository.detachFromProduct(promoCodeId, productId);
}

// One click for "5% sur tout le catalogue" instead of attaching product by product —
// re-running it with a new value just refreshes every attachment (upsert underneath).
export async function attachToAllProducts({
  promoCodeId,
  discountType,
  discountValue,
}: {
  promoCodeId: string;
  discountType: string;
  discountValue: number;
}) {
  assertValidDiscount(discountType, discountValue);

  const productIds = await catalogRepository.listAllProductIds();
  if (productIds.length === 0) return [];

  return promoCodeRepository.attachToProducts(promoCodeId, productIds, discountType, discountValue);
}

export function detachFromAllProducts(promoCodeId: string) {
  return promoCodeRepository.detachAll(promoCodeId);
}

// Called by the Messenger bot before it even offers the "as-tu un code promo ?" step —
// no point prompting when nothing could possibly apply to this product.
export function hasActivePromoForProduct(productId: string) {
  return promoCodeRepository.hasActivePromoForProduct(productId);
}

// Called by orderService at checkout — a code is optional, so no code given is not an
// error; a code given that doesn't resolve for this exact product IS an error, so the
// customer gets a clear reason instead of silently paying full price.
export async function resolveDiscount(code: string | undefined, productId: string, salePrice: number) {
  if (!code) return { promoCodeUsed: null, discountAr: 0, finalAmount: salePrice };

  const attachment = await promoCodeRepository.findAttachmentForCheckout(code.trim().toUpperCase(), productId);
  if (!attachment) throw new AppError('Ce code promo ne s\'applique pas à ce produit, ou a expiré', 400);

  const discountAr =
    attachment.discountType === 'percent' ? salePrice * (attachment.discountValue / 100) : Math.min(attachment.discountValue, salePrice);

  return {
    promoCodeUsed: attachment.promoCode.code,
    discountAr: Math.round(discountAr),
    finalAmount: Math.max(0, Math.round(salePrice - discountAr)),
  };
}
