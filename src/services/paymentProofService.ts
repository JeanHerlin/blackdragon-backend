import AppError from '../utils/AppError';
import * as orderRepository from '../repositories/orderRepository';
import * as notificationService from './notificationService';
import * as customerNotificationService from './customerNotificationService';
import * as orderService from './orderService';
import { hashToken } from '../utils/secureToken';

const INVALID_LINK_MESSAGE = 'This link is no longer valid or has expired.';

async function resolveValidToken(rawToken: string) {
  const record = await orderRepository.findPaymentProofTokenByHash(hashToken(rawToken));

  const isValid =
    record && !record.usedAt && record.expiresAt > new Date() && record.order.payment?.status === 'awaiting_proof';

  if (!isValid) {
    // Same generic message whether the token is missing, expired, already used, or the
    // proof was already submitted — never reveal which, this page has no admin session.
    throw new AppError(INVALID_LINK_MESSAGE, 400);
  }

  return record;
}

export async function getProofContext(rawToken: string) {
  const record = await resolveValidToken(rawToken);
  const { order } = record;

  return {
    productLabel: order.product.label,
    amount: order.amount,
  };
}

export async function submitProof(
  rawToken: string,
  { senderPhone, reference, proofImageUrl }: { senderPhone: string; reference: string; proofImageUrl: string },
): Promise<{ deliverLink?: string }> {
  // Revalidate from scratch rather than trusting the earlier GET — same reasoning as
  // credentialDeliveryService.submitCredentials.
  const record = await resolveValidToken(rawToken);
  const { order } = record;

  if (!senderPhone || !reference || !proofImageUrl) {
    throw new AppError('senderPhone, reference and proofImageUrl are required', 400);
  }

  await orderRepository.updatePayment(order.id, { senderPhone, reference, proofImageUrl, status: 'proof_submitted' });
  await orderRepository.markPaymentProofTokenUsed(record.id);

  const fresh = await orderRepository.findById(order.id);
  await notificationService.notify('cashpoint_proof_submitted', fresh!);

  // "compte" orders don't wait on admin validation to ask for credentials — the customer
  // gets sent straight from this proof form to the credentials form (deliverLink, handled
  // by the frontend page), so the admin can validate the deposit and process the order in
  // one pass once credentials are already in hand. "uid" orders have nothing to collect
  // here, so they just get a Messenger ack and wait for the admin's review.
  if (fresh!.product.category.requiresAccountCredentials) {
    const { deliverLink } = await orderService.startManualDelivery(fresh!);
    return { deliverLink };
  }

  await customerNotificationService.notifyCustomer(order.messengerPsid, 'Paiement en attente de vérification. On te confirme dès que ton dépôt Cashpoint est validé.');
  return {};
}
