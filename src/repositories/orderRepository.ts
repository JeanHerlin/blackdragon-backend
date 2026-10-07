import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

const withRelations = {
  product: {
    include: {
      category: true,
      game: true,
      sourceCatalogEntry: true,
      bundleItems: { include: { catalogEntry: true } },
    },
  },
  payment: true,
  delivery: { include: { items: { include: { catalogEntry: true } } } },
  accountCredential: true,
  credentialToken: true,
} satisfies Prisma.OrderInclude;

export function createOrder(data: Prisma.OrderUncheckedCreateInput) {
  return prisma.order.create({ data, include: withRelations });
}

export function createDeliveryItems(deliveryId: string, items: { catalogEntryId: string; label: string }[]) {
  return prisma.deliveryItem.createMany({ data: items.map((item) => ({ deliveryId, ...item })) });
}

export function updateDeliveryItem(id: string, data: Prisma.DeliveryItemUpdateInput) {
  return prisma.deliveryItem.update({ where: { id }, data });
}

export async function getStatusCounts(): Promise<Record<string, number>> {
  const groups = await prisma.order.groupBy({ by: ['status'], _count: true });
  return Object.fromEntries(groups.map((g) => [g.status, g._count]));
}

export function countDeliveredSince(date: Date) {
  return prisma.order.count({ where: { status: 'delivered', updatedAt: { gte: date } } });
}

export function findById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: withRelations });
}

export function updateStatus(id: string, status: string) {
  return prisma.order.update({ where: { id }, data: { status }, include: withRelations });
}

// Used by reject/flag-issue (set a reason) and resolve (clear it, note: undefined).
export function updateStatusAndNote(id: string, status: string, note?: string | null) {
  return prisma.order.update({ where: { id }, data: { status, adminNote: note }, include: withRelations });
}

// "Needs action" statuses surface first — see backoffice-ux skill's priority-queue rule.
const PRIORITY_STATUSES = ['delivery_failed', 'manual_pending', 'issue'];

// Powers the PWA badge count — "manual_pending" + "issue" are the only compte statuses
// that actually need an admin action; pending_payment is just waiting on the customer.
export function countNeedsAttention(purchaseType: string) {
  return prisma.order.count({ where: { purchaseType, status: { in: ['manual_pending', 'issue'] } } });
}

// UID orders stuck in "delivery_failed" are orders whose auto_g2bulk delivery call
// actually failed (see orderService's deliverOrder catch) — a real g2bulk outage
// signal, distinct from the admin-triggered catalog price sync.
export function countUidDeliveryFailed() {
  return prisma.order.count({ where: { purchaseType: 'uid', status: 'delivery_failed' } });
}

export async function listOrders({ status, purchaseType }: { status?: string; purchaseType?: string } = {}) {
  const orders = await prisma.order.findMany({
    where: { ...(status ? { status } : {}), ...(purchaseType ? { purchaseType } : {}) },
    include: withRelations,
    orderBy: { createdAt: 'asc' },
  });

  return orders.sort((a, b) => {
    const aPriority = PRIORITY_STATUSES.includes(a.status) ? 0 : 1;
    const bPriority = PRIORITY_STATUSES.includes(b.status) ? 0 : 1;
    return aPriority - bPriority;
  });
}

// --- Dashboard stats (all range-scoped by createdAt, never updatedAt — a sale is
// attributed to when it was placed, not whenever its status last changed) ---

export async function getDeliveredSummarySince(dateFrom: Date) {
  const result = await prisma.order.aggregate({
    where: { status: 'delivered', createdAt: { gte: dateFrom } },
    _count: true,
    _sum: { amount: true },
    _avg: { amount: true },
  });
  return { count: result._count, revenue: result._sum.amount || 0, avgBasket: result._avg.amount || 0 };
}

export function countOrdersSince(dateFrom: Date) {
  return prisma.order.count({ where: { createdAt: { gte: dateFrom } } });
}

export async function getDeliveredSplitByPurchaseType(dateFrom: Date): Promise<Record<string, number>> {
  const groups = await prisma.order.groupBy({
    by: ['purchaseType'],
    where: { status: 'delivered', createdAt: { gte: dateFrom } },
    _count: true,
  });
  return Object.fromEntries(groups.map((g) => [g.purchaseType, g._count]));
}

// Success rate denominator: a UID order only ever ends in "delivered" or
// "delivery_failed" (auto delivery has no other terminal states) — so these two
// statuses together are every UID order that has actually been attempted.
export async function getUidDeliveryOutcomesSince(dateFrom: Date): Promise<Record<string, number>> {
  const groups = await prisma.order.groupBy({
    by: ['status'],
    where: { purchaseType: 'uid', status: { in: ['delivered', 'delivery_failed'] }, createdAt: { gte: dateFrom } },
    _count: true,
  });
  return Object.fromEntries(groups.map((g) => [g.status, g._count]));
}

export async function getTopProductsSoldSince(dateFrom: Date, limit: number) {
  const groups = await prisma.order.groupBy({
    by: ['productId'],
    where: { status: 'delivered', createdAt: { gte: dateFrom } },
    _count: true,
    _sum: { amount: true },
    orderBy: { _count: { productId: 'desc' } },
    take: limit,
  });

  const products = await prisma.product.findMany({
    where: { id: { in: groups.map((g) => g.productId) } },
    include: { category: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return groups
    .map((g) => {
      const product = byId.get(g.productId);
      if (!product) return null;
      return { product, qty: g._count, revenue: g._sum.amount || 0 };
    })
    .filter((row): row is { product: NonNullable<typeof row>['product']; qty: number; revenue: number } => row !== null);
}

// Day-by-day revenue for the 7d/month ranges — raw SQL because Prisma's groupBy can't
// truncate a timestamp to a day boundary. "today" never calls this: one day has no
// useful day-by-day breakdown.
export function getDailyRevenueSince(dateFrom: Date): Promise<{ day: Date; revenue: number }[]> {
  return prisma.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, SUM("amount")::float AS revenue
    FROM "Order"
    WHERE "status" = 'delivered' AND "createdAt" >= ${dateFrom}
    GROUP BY day
    ORDER BY day ASC
  `;
}

export async function getCategoryDaySummary(categoryId: string, dayStart: Date, dayEnd: Date) {
  const result = await prisma.order.aggregate({
    where: { product: { categoryId }, status: 'delivered', updatedAt: { gte: dayStart, lt: dayEnd } },
    _count: true,
    _sum: { amount: true },
  });
  return { salesCount: result._count, revenue: result._sum.amount || 0 };
}

export function countPendingForCategory(categoryId: string) {
  return prisma.order.count({
    where: { product: { categoryId }, status: { in: ['pending_payment', 'delivering', 'manual_pending'] } },
  });
}

export function countDeliveryFailedForCategory(categoryId: string) {
  return prisma.order.count({ where: { product: { categoryId }, status: 'delivery_failed' } });
}

export async function getSoldCountsByProduct(categoryId: string, dayStart: Date, dayEnd: Date): Promise<Record<string, number>> {
  const groups = await prisma.order.groupBy({
    by: ['productId'],
    where: { product: { categoryId }, status: 'delivered', updatedAt: { gte: dayStart, lt: dayEnd } },
    _count: true,
  });
  return Object.fromEntries(groups.map((g) => [g.productId, g._count]));
}

export function listPendingOrdersForCategory(categoryId: string) {
  return prisma.order.findMany({
    where: { product: { categoryId }, status: { in: ['pending_payment', 'delivering', 'manual_pending', 'delivery_failed'] } },
    include: { product: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listCustomersForCategory(categoryId: string) {
  return prisma.order.findMany({
    where: { product: { categoryId } },
    select: { customerRef: true, amount: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function createPayment(orderId: string, data: Omit<Prisma.PaymentUncheckedCreateInput, 'orderId'>) {
  return prisma.payment.create({ data: { orderId, ...data } });
}

export function findPaymentByReference(providerRef: string) {
  return prisma.payment.findUnique({ where: { providerRef }, include: { order: { include: withRelations } } });
}

export function updatePaymentStatus(orderId: string, status: string) {
  return prisma.payment.update({ where: { orderId }, data: { status } });
}

export function createDelivery(orderId: string, data: Omit<Prisma.DeliveryUncheckedCreateInput, 'orderId'>) {
  return prisma.delivery.create({ data: { orderId, ...data } });
}

export function updateDelivery(orderId: string, data: Prisma.DeliveryUpdateInput) {
  return prisma.delivery.update({ where: { orderId }, data });
}

export function createCredentialToken(orderId: string, data: Omit<Prisma.CredentialTokenUncheckedCreateInput, 'orderId'>) {
  return prisma.credentialToken.create({ data: { orderId, ...data } });
}

export function findCredentialTokenByHash(tokenHash: string) {
  return prisma.credentialToken.findUnique({
    where: { tokenHash },
    include: { order: { include: withRelations } },
  });
}

export function markCredentialTokenUsed(id: string) {
  return prisma.credentialToken.update({ where: { id }, data: { usedAt: new Date() } });
}

export function createAccountCredential(orderId: string, data: Omit<Prisma.AccountCredentialUncheckedCreateInput, 'orderId'>) {
  return prisma.accountCredential.create({ data: { orderId, ...data } });
}

export function markCredentialViewed(orderId: string) {
  return prisma.accountCredential.update({ where: { orderId }, data: { viewedAt: new Date() } });
}
