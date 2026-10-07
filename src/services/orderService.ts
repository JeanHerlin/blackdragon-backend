import crypto from 'crypto';

import env from '../config/env';
import AppError from '../utils/AppError';
import * as orderRepository from '../repositories/orderRepository';
import * as catalogService from './catalogService';
import * as notificationService from './notificationService';
import * as settingsService from './settingsService';
import * as promoCodeService from './promoCodeService';
import paymentProvider from '../providers/payment';
import deliveryProvider from '../providers/delivery';
import { generateRawToken, hashToken } from '../utils/secureToken';

const CREDENTIAL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type OrderWithRelations = NonNullable<Awaited<ReturnType<typeof orderRepository.findById>>>;
type DeliverableProduct = OrderWithRelations['product'];

export async function createOrder({
  productId,
  targetUid,
  customerRef,
  channel,
  promoCode,
}: {
  productId: string;
  targetUid?: string;
  customerRef?: string;
  channel?: string;
  promoCode?: string;
}) {
  const product = await catalogService.getProductOrThrow(productId);

  if (product.category.requiresAccountCredentials) {
    const settings = await settingsService.getSettings();
    if (!settings.isAdminActive) {
      throw new AppError('Les commandes par compte sont temporairement indisponibles', 503);
    }
  }

  if (!targetUid) {
    throw new AppError('targetUid is required', 400);
  }

  // Not mandatory — resolveDiscount passes through at full price when promoCode is
  // undefined, and only throws if a code WAS given but doesn't apply to this product.
  const { promoCodeUsed, discountAr, finalAmount } = await promoCodeService.resolveDiscount(promoCode, product.id, product.salePrice);

  const order = await orderRepository.createOrder({
    channel: channel || 'dev',
    customerRef: customerRef || 'anonymous',
    productId: product.id,
    purchaseType: product.category.requiresAccountCredentials ? 'compte' : 'uid',
    targetUid,
    amount: finalAmount,
    promoCodeUsed,
    discountAr,
    status: 'pending_payment',
  });

  const providerRef = crypto.randomUUID();
  await orderRepository.createPayment(order.id, { provider: 'papi', providerRef, status: 'pending' });

  const { paymentLink } = await paymentProvider.createPaymentLink({
    reference: providerRef,
    amount: finalAmount,
    description: product.label,
    clientName: customerRef,
  });

  return { order, paymentLink };
}

export async function getPaymentContext(providerRef: string) {
  const payment = await orderRepository.findPaymentByReference(providerRef);
  if (!payment) throw new AppError('Payment link not found', 404);

  return {
    status: payment.status,
    amount: payment.order.amount,
    productLabel: payment.order.product.label,
  };
}

// Called both by the mock confirm page and, later, by the real papi.mg webhook handler —
// same transition either way, so the mock and the real integration stay behaviorally identical.
export async function confirmPayment(providerRef: string, outcome: string) {
  const payment = await orderRepository.findPaymentByReference(providerRef);
  if (!payment) throw new AppError('Payment link not found', 404);
  if (payment.status !== 'pending') {
    throw new AppError('This payment has already been processed', 409);
  }

  if (outcome !== 'success') {
    await orderRepository.updatePaymentStatus(payment.orderId, 'failed');
    await orderRepository.updateStatus(payment.orderId, 'payment_failed');
    return { status: 'payment_failed' };
  }

  await orderRepository.updatePaymentStatus(payment.orderId, 'success');
  const order = await orderRepository.updateStatus(payment.orderId, 'paid');
  return handlePaymentSuccess(order);
}

async function handlePaymentSuccess(order: OrderWithRelations) {
  const product = order.product;

  if (product.category.requiresAccountCredentials) {
    await orderRepository.createDelivery(order.id, { mode: 'manual', status: 'pending' });
    await orderRepository.updateStatus(order.id, 'manual_pending');

    const rawToken = generateRawToken();
    await orderRepository.createCredentialToken(order.id, {
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + CREDENTIAL_TOKEN_TTL_MS),
    });

    const fresh = await orderRepository.findById(order.id);
    await notificationService.notify('manual_delivery_pending', fresh!);

    // In production this link is sent to the customer via the Messenger bot, not returned
    // here — but that adapter doesn't exist yet, so we surface it directly for testing.
    return { status: 'manual_pending', deliverLink: `${env.frontendUrl}/deliver/${rawToken}` };
  }

  const delivery = await orderRepository.createDelivery(order.id, { mode: 'auto_g2bulk', status: 'pending' });
  const components = resolveDeliveryComponents(product);
  await orderRepository.createDeliveryItems(delivery.id, components.map(({ catalogEntryId, label }) => ({ catalogEntryId, label })));
  await orderRepository.updateStatus(order.id, 'delivering');
  return runAutoDelivery(order.id);
}

// A normal product is one component; a bundle is one per unit of quantity across its
// ProductBundleItems (see catalogService.createBundleProduct) — a repeated pack
// ("same pack x2") becomes two separate delivery calls, each tracked on its own so a
// partial failure says exactly which unit didn't go through, not just which pack.
function resolveDeliveryComponents(product: DeliverableProduct): { catalogEntryId: string; supplierRef: string; label: string }[] {
  if (product.isBundle) {
    return product.bundleItems.flatMap((item) =>
      Array.from({ length: item.quantity }, (_, i) => ({
        catalogEntryId: item.catalogEntryId,
        supplierRef: item.catalogEntry.supplierRef,
        label: item.quantity > 1 ? `${item.catalogEntry.name} (${i + 1}/${item.quantity})` : item.catalogEntry.name,
      })),
    );
  }

  if (!product.sourceCatalogEntry) {
    throw new AppError('Ce produit auto_g2bulk n\'a pas de référence fournisseur valide', 500);
  }
  return [{ catalogEntryId: product.sourceCatalogEntry.id, supplierRef: product.sourceCatalogEntry.supplierRef, label: product.label }];
}

// Only (re)attempts items not already "success" — a retry after a partial bundle
// failure never re-delivers the components the customer already received.
async function runAutoDelivery(orderId: string) {
  const order = await orderRepository.findById(orderId);
  const items = order!.delivery!.items;

  for (const item of items) {
    if (item.status === 'success') continue;
    try {
      await deliveryProvider.deliverTopUp({ uid: order!.targetUid as string, supplierRef: item.catalogEntry.supplierRef });
      await orderRepository.updateDeliveryItem(item.id, { status: 'success', deliveredAt: new Date(), lastError: null });
    } catch (err: any) {
      await orderRepository.updateDeliveryItem(item.id, { status: 'failed', lastError: err.message });
    }
  }

  const fresh = await orderRepository.findById(orderId);
  const freshItems = fresh!.delivery!.items;
  const failed = freshItems.filter((i) => i.status !== 'success');

  if (failed.length === 0) {
    await orderRepository.updateDelivery(orderId, { status: 'success', deliveredAt: new Date(), attempts: { increment: 1 } });
    await orderRepository.updateStatus(orderId, 'delivered');
    return { status: 'delivered' };
  }

  const failedLabels = failed.map((i) => i.label);
  await orderRepository.updateDelivery(orderId, {
    status: 'failed',
    lastError: `Échec: ${failedLabels.join(', ')}`,
    attempts: { increment: 1 },
  });
  await orderRepository.updateStatus(orderId, 'delivery_failed');
  await notificationService.notify('delivery_failed', fresh!);
  return { status: 'delivery_failed', failedItems: failedLabels };
}

export async function retryDelivery(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== 'delivery_failed') {
    throw new AppError('Order is not in a failed-delivery state', 400);
  }

  await orderRepository.updateStatus(orderId, 'delivering');
  return runAutoDelivery(orderId);
}

export async function markManualDelivered(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (!['delivery_failed', 'manual_pending', 'credentials_received'].includes(order.status)) {
    throw new AppError('Order is not awaiting delivery', 400);
  }

  await orderRepository.updateDelivery(orderId, { status: 'success', deliveredAt: new Date() });
  return orderRepository.updateStatus(orderId, 'delivered');
}

const TERMINAL_STATUSES = ['delivered', 'rejected'];

// Admin decides not to fulfill (fraud, unreachable customer, etc.) — distinct from
// payment_failed, which is an automatic payment-layer event, not a human decision.
export async function rejectOrder(orderId: string, note?: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (TERMINAL_STATUSES.includes(order.status)) {
    throw new AppError('Order is already in a final state', 400);
  }
  return orderRepository.updateStatusAndNote(orderId, 'rejected', note || null);
}

// A separate state from the normal pipeline (not a sub-status of manual_pending/
// credentials_received) so an order can be "stuck on a problem" regardless of where it
// was in the flow when the problem showed up.
export async function flagIssue(orderId: string, note: string) {
  if (!note || typeof note !== 'string') throw new AppError('note is required', 400);
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (TERMINAL_STATUSES.includes(order.status)) {
    throw new AppError('Order is already in a final state', 400);
  }
  return orderRepository.updateStatusAndNote(orderId, 'issue', note);
}

export async function resolveIssue(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== 'issue') {
    throw new AppError('Order does not have an open issue', 400);
  }
  // Resume wherever it naturally sits in the pipeline: credentials already in means
  // it's ready for the admin to action again, otherwise it's still waiting on the customer.
  const nextStatus = order.accountCredential ? 'credentials_received' : 'manual_pending';
  return orderRepository.updateStatusAndNote(orderId, nextStatus, null);
}

export function listOrders({ status, purchaseType }: { status?: string; purchaseType?: string } = {}) {
  return orderRepository.listOrders({ status, purchaseType });
}

export async function getOrder(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  return order;
}
