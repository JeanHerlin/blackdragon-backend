import crypto from 'crypto';

import env from '../config/env';
import AppError from '../utils/AppError';
import * as orderRepository from '../repositories/orderRepository';
import * as catalogService from './catalogService';
import * as notificationService from './notificationService';
import * as promoCodeService from './promoCodeService';
import * as customerNotificationService from './customerNotificationService';
import paymentProvider from '../providers/payment';
import deliveryProvider from '../providers/delivery';
import { generateRawToken, hashToken } from '../utils/secureToken';

const CREDENTIAL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PAYMENT_PROOF_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type OrderWithRelations = NonNullable<Awaited<ReturnType<typeof orderRepository.findById>>>;
type DeliverableProduct = OrderWithRelations['product'];

// Used by the Messenger bot to confirm a typed UID is real before asking the customer
// to validate it ("c'est bien ton compte ?") — same g2bulk check for both "uid" and
// "compte" purchases. For "compte" the UID is never used for delivery (that happens by
// logging into the account the customer hands over later), it's stored purely as a
// cross-check the admin can compare once they're actually inside the account.
export async function verifyPlayer(targetUid: string) {
  return deliveryProvider.verifyPlayer({ uid: targetUid });
}

// Customer-facing wording for "suivre ma commande" / "mes commandes" — deliberately
// different from the admin's STATUS_SUBLABEL (frontend/lib/orders.ts): the customer
// doesn't care about our internal pipeline names, just what's actually happening.
const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'En attente de paiement',
  paid: 'Paiement reçu, traitement en cours',
  delivering: 'Livraison en cours',
  payment_failed: 'Paiement échoué',
  manual_pending: 'Paiement confirmé, traitement en cours',
  credentials_received: 'Identifiants reçus, traitement en cours',
  delivered: '✅ Livré',
  delivery_failed: 'Livraison en échec — notre équipe s\'en occupe',
  issue: '⚠️ Problème signalé — contacte-nous si besoin',
  rejected: '❌ Commande refusée',
};

export function customerStatusLabel(status: string): string {
  return CUSTOMER_STATUS_LABELS[status] || status;
}

export function listCustomerOrders(messengerPsid: string, limit = 5) {
  return orderRepository.listByMessengerPsid(messengerPsid, limit);
}

export async function createOrder({
  productId,
  targetUid,
  customerRef,
  channel,
  promoCode,
  paymentMethod,
  messengerPsid,
}: {
  productId: string;
  targetUid?: string;
  customerRef?: string;
  channel?: string;
  promoCode?: string;
  paymentMethod?: 'papi' | 'cashpoint';
  messengerPsid?: string;
}) {
  const product = await catalogService.getProductOrThrow(productId);

  // Admin-inactive no longer blocks the order outright — the bot warns the customer
  // about it before they pay (see conversationFlow's askPaymentMethod), and they can
  // still choose to go through with it knowing delivery might take a bit longer.

  // A "compte" order never has a target UID — delivery happens by logging into the
  // customer's own account (credentials collected after payment, see startManualDelivery).
  // Only "uid" orders (direct top-up) need one, since g2bulk delivers straight to it.
  if (!product.category.requiresAccountCredentials && !targetUid) {
    throw new AppError('targetUid is required', 400);
  }

  // Not mandatory — resolveDiscount passes through at full price when promoCode is
  // undefined, and only throws if a code WAS given but doesn't apply to this product.
  const { promoCodeUsed, discountAr, finalAmount } = await promoCodeService.resolveDiscount(promoCode, product.id, product.salePrice);

  const order = await orderRepository.createOrder({
    channel: channel || 'dev',
    customerRef: customerRef || 'anonymous',
    messengerPsid,
    productId: product.id,
    purchaseType: product.category.requiresAccountCredentials ? 'compte' : 'uid',
    targetUid,
    amount: finalAmount,
    promoCodeUsed,
    discountAr,
    status: 'pending_payment',
  });

  if (paymentMethod === 'cashpoint') {
    // No automated callback for a cash deposit — the customer submits proof themselves
    // (sender phone, reference, screenshot) through a token-protected link, same pattern
    // as the account-credential delivery link. See paymentProofService.
    await orderRepository.createPayment(order.id, { provider: 'cashpoint', providerRef: crypto.randomUUID(), status: 'awaiting_proof' });

    const rawToken = generateRawToken();
    await orderRepository.createPaymentProofToken(order.id, {
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + PAYMENT_PROOF_TOKEN_TTL_MS),
    });

    return { order, paymentMethod: 'cashpoint' as const, proofSubmitLink: `${env.frontendUrl}/pay-proof/${rawToken}` };
  }

  const providerRef = crypto.randomUUID();
  const { paymentLink, notificationToken } = await paymentProvider.createPaymentLink({
    reference: providerRef,
    amount: finalAmount,
    description: product.label,
    clientName: customerRef,
  });

  await orderRepository.createPayment(order.id, { provider: 'papi', providerRef, status: 'pending', notificationToken });

  return { order, paymentMethod: 'papi' as const, paymentLink };
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

  await customerNotificationService.notifyCustomer(order.messengerPsid, 'Paiement reçu ! On traite ta commande.');

  return handlePaymentSuccess(order);
}

async function handlePaymentSuccess(order: OrderWithRelations) {
  if (order.product.category.requiresAccountCredentials) {
    return startManualDelivery(order);
  }
  return startAutoDelivery(order);
}

// Triggers the "give us your login" step for a "compte" order. Called from two very
// different moments on purpose: right after a papi payment actually succeeds (real
// money confirmed), but for cashpoint right when the customer submits their deposit
// proof — BEFORE the admin validates it (see paymentProofService.submitProof) — so the
// customer isn't left waiting on the admin before they can hand over credentials.
// The deliverLink is handed back to whichever web form the customer is already on
// (the mock-pay page or the proof-submission page), which sends them straight to the
// credentials form — no separate Messenger round-trip needed for this step.
export async function startManualDelivery(order: OrderWithRelations) {
  await orderRepository.createDelivery(order.id, { mode: 'manual', status: 'pending' });
  await orderRepository.updateStatus(order.id, 'manual_pending');

  const rawToken = generateRawToken();
  await orderRepository.createCredentialToken(order.id, {
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + CREDENTIAL_TOKEN_TTL_MS),
  });

  const fresh = await orderRepository.findById(order.id);
  await notificationService.notify('manual_delivery_pending', fresh!);

  return { status: 'manual_pending', deliverLink: `${env.frontendUrl}/deliver/${rawToken}` };
}

// Shared by the papi webhook path (fires immediately) and launchG2bulkDelivery (the
// cashpoint admin's explicit button, deliberately NOT automatic — see that function).
async function startAutoDelivery(order: OrderWithRelations) {
  const delivery = await orderRepository.createDelivery(order.id, { mode: 'auto_g2bulk', status: 'pending' });
  const components = resolveDeliveryComponents(order.product);
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

// Admin reviewed the cashpoint proof (sender phone, reference, screenshot) and confirms
// the deposit really arrived. For "compte", the manual-delivery flow (credentials
// requested from the customer) was already kicked off the moment the proof was
// submitted — see paymentProofService.submitProof — so this only confirms the deposit
// was real, it must not reset or re-trigger that flow. For "uid", it deliberately stops
// at "paid": g2bulk delivery only starts when the admin clicks the separate
// launchG2bulkDelivery button, since confirming a cash deposit and authorizing the
// actual spend are two distinct decisions.
export async function confirmCashpointPayment(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.payment?.provider !== 'cashpoint' || order.payment.status !== 'proof_submitted') {
    throw new AppError('This order has no cashpoint proof awaiting validation', 400);
  }

  await orderRepository.updatePayment(orderId, { status: 'confirmed' });

  if (order.product.category.requiresAccountCredentials) {
    return orderRepository.findById(orderId);
  }

  await orderRepository.updateStatus(orderId, 'paid');
  return { status: 'paid' };
}

export async function rejectCashpointPayment(orderId: string, reason?: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.payment?.provider !== 'cashpoint' || order.payment.status !== 'proof_submitted') {
    throw new AppError('This order has no cashpoint proof awaiting validation', 400);
  }

  await orderRepository.updatePayment(orderId, { status: 'rejected' });
  const result = await orderRepository.updateStatusAndNote(orderId, 'payment_failed', reason || 'Preuve de paiement Cashpoint refusée');

  await customerNotificationService.notifyCustomer(
    order.messengerPsid,
    `Ta preuve de paiement Cashpoint pour la commande #${orderId.slice(0, 8)} a été refusée : ${reason || 'preuve invalide'}. Contacte-nous pour renvoyer une preuve correcte.`,
  );

  return result;
}

// The explicit "launch delivery" button for a confirmed cashpoint UID order — see
// confirmCashpointPayment for why this doesn't happen automatically.
export async function launchG2bulkDelivery(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== 'paid' || order.purchaseType !== 'uid') {
    throw new AppError('Order is not a paid UID order awaiting delivery', 400);
  }

  return startAutoDelivery(order);
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
  const result = await orderRepository.updateStatusAndNote(orderId, 'rejected', note || null);

  await customerNotificationService.notifyCustomer(
    order.messengerPsid,
    `Ta commande #${orderId.slice(0, 8)} a été refusée${note ? ` : ${note}` : '.'} Contacte-nous si tu as des questions.`,
  );

  return result;
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
  const result = await orderRepository.updateStatusAndNote(orderId, 'issue', note);

  await customerNotificationService.notifyCustomer(
    order.messengerPsid,
    `Il y a un souci avec ta commande #${orderId.slice(0, 8)} : ${note}. Réponds ici si tu as des questions.`,
  );

  return result;
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

export function listOrders({
  status,
  purchaseType,
  paymentProvider,
}: { status?: string; purchaseType?: string; paymentProvider?: string } = {}) {
  return orderRepository.listOrders({ status, purchaseType, paymentProvider });
}

export async function getOrder(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

// Dedicated retrieval endpoint — mirrors credentialViewService.revealCredentials in
// shape (one explicit call per order) even though, unlike login/password, none of this
// is encrypted at rest: a phone number and a reference aren't account secrets.
export async function getCashpointProof(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order || order.payment?.provider !== 'cashpoint') {
    throw new AppError('No cashpoint payment for this order', 404);
  }

  return {
    status: order.payment.status,
    senderPhone: order.payment.senderPhone,
    reference: order.payment.reference,
    proofImageUrl: order.payment.proofImageUrl,
  };
}
