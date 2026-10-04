import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

const withRelations = {
  product: { include: { category: true, game: true } },
  payment: true,
  delivery: true,
  accountCredential: true,
  credentialToken: true,
} satisfies Prisma.OrderInclude;

export function createOrder(data: Prisma.OrderUncheckedCreateInput) {
  return prisma.order.create({ data, include: withRelations });
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
