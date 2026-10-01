import crypto from 'crypto';

import env from '../config/env';
import AppError from '../utils/AppError';
import * as orderRepository from '../repositories/orderRepository';
import * as catalogService from './catalogService';
import * as notificationService from './notificationService';
import * as settingsService from './settingsService';
import paymentProvider from '../providers/payment';
import deliveryProvider from '../providers/delivery';
import { generateRawToken, hashToken } from '../utils/secureToken';

const CREDENTIAL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type OrderWithRelations = NonNullable<Awaited<ReturnType<typeof orderRepository.findById>>>;
type ProductWithCategory = Awaited<ReturnType<typeof catalogService.getProductOrThrow>>;

export async function createOrder({
  productId,
  targetUid,
  customerRef,
  channel,
}: {
  productId: string;
  targetUid?: string;
  customerRef?: string;
  channel?: string;
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

  const order = await orderRepository.createOrder({
    channel: channel || 'dev',
    customerRef: customerRef || 'anonymous',
    productId: product.id,
    purchaseType: product.category.requiresAccountCredentials ? 'compte' : 'uid',
    targetUid,
    amount: product.salePrice,
    status: 'pending_payment',
  });

  const providerRef = crypto.randomUUID();
  await orderRepository.createPayment(order.id, { provider: 'papi', providerRef, status: 'pending' });

  const { paymentLink } = await paymentProvider.createPaymentLink({
    reference: providerRef,
    amount: product.salePrice,
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

  await orderRepository.createDelivery(order.id, { mode: 'auto_g2bulk', status: 'pending' });
  await orderRepository.updateStatus(order.id, 'delivering');
  return runAutoDelivery(order.id, product as ProductWithCategory);
}

async function runAutoDelivery(orderId: string, product: ProductWithCategory) {
  const order = await orderRepository.findById(orderId);

  try {
    await deliveryProvider.deliverTopUp({ uid: order!.targetUid as string, product });
    await orderRepository.updateDelivery(orderId, {
      status: 'success',
      deliveredAt: new Date(),
      attempts: { increment: 1 },
    });
    await orderRepository.updateStatus(orderId, 'delivered');
    return { status: 'delivered' };
  } catch (err: any) {
    await orderRepository.updateDelivery(orderId, {
      status: 'failed',
      lastError: err.message,
      attempts: { increment: 1 },
    });
    await orderRepository.updateStatus(orderId, 'delivery_failed');

    const fresh = await orderRepository.findById(orderId);
    await notificationService.notify('delivery_failed', fresh!);
    return { status: 'delivery_failed', error: err.message };
  }
}

export async function retryDelivery(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== 'delivery_failed') {
    throw new AppError('Order is not in a failed-delivery state', 400);
  }

  await orderRepository.updateStatus(orderId, 'delivering');
  return runAutoDelivery(orderId, order.product as ProductWithCategory);
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

export function listOrders(status?: string) {
  return orderRepository.listOrders({ status });
}

export async function getOrder(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  return order;
}
