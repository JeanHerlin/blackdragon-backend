import prisma from '../config/prisma';

const withAttachments = {
  products: { include: { product: true } },
} as const;

export function listAll() {
  return prisma.promoCode.findMany({ include: withAttachments, orderBy: { createdAt: 'desc' } });
}

export function findByCode(code: string) {
  return prisma.promoCode.findUnique({ where: { code }, include: withAttachments });
}

export function create(code: string, title: string) {
  return prisma.promoCode.create({ data: { code, title }, include: withAttachments });
}

export function remove(id: string) {
  return prisma.promoCode.delete({ where: { id } });
}

export function setActive(id: string, isActive: boolean) {
  return prisma.promoCode.update({ where: { id }, data: { isActive } });
}

export function attachToProduct(data: { promoCodeId: string; productId: string; discountType: string; discountValue: number }) {
  return prisma.promoCodeProduct.upsert({
    where: { promoCodeId_productId: { promoCodeId: data.promoCodeId, productId: data.productId } },
    create: data,
    update: { discountType: data.discountType, discountValue: data.discountValue },
  });
}

export function detachFromProduct(promoCodeId: string, productId: string) {
  return prisma.promoCodeProduct.deleteMany({ where: { promoCodeId, productId } });
}

// One click instead of attaching product by product — upsert per product so re-running
// it (e.g. after the catalog grows) just refreshes the discount instead of erroring.
export function attachToProducts(promoCodeId: string, productIds: string[], discountType: string, discountValue: number) {
  return prisma.$transaction(
    productIds.map((productId) =>
      prisma.promoCodeProduct.upsert({
        where: { promoCodeId_productId: { promoCodeId, productId } },
        create: { promoCodeId, productId, discountType, discountValue },
        update: { discountType, discountValue },
      }),
    ),
  );
}

export function detachAll(promoCodeId: string) {
  return prisma.promoCodeProduct.deleteMany({ where: { promoCodeId } });
}

// Checkout-time lookup — a code only actually discounts a given order if it's active
// AND has an explicit attachment to that exact product (see client's requirement that
// the same code can carry a different discount per product).
export function findAttachmentForCheckout(code: string, productId: string) {
  return prisma.promoCodeProduct.findFirst({
    where: { productId, promoCode: { code, isActive: true } },
    include: { promoCode: true },
  });
}

// Powers the bot's decision to even ask "as-tu un code promo ?" — no point prompting
// when nothing could possibly apply to this product.
export async function hasActivePromoForProduct(productId: string): Promise<boolean> {
  const match = await prisma.promoCodeProduct.findFirst({ where: { productId, promoCode: { isActive: true } } });
  return match !== null;
}
