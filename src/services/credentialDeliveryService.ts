import AppError from '../utils/AppError';
import * as orderRepository from '../repositories/orderRepository';
import * as notificationService from './notificationService';
import * as credentialCrypto from '../utils/credentialCrypto';
import { hashToken } from '../utils/secureToken';

const INVALID_LINK_MESSAGE = 'This link is no longer valid or has expired.';

async function resolveValidToken(rawToken: string) {
  const record = await orderRepository.findCredentialTokenByHash(hashToken(rawToken));

  const isValid = record && !record.usedAt && record.expiresAt > new Date() && record.order.status === 'manual_pending';

  if (!isValid) {
    // Same generic message whether the token is missing, expired, already used, or the
    // order moved on — never reveal which, this page has no admin session to fall back to.
    throw new AppError(INVALID_LINK_MESSAGE, 400);
  }

  return record;
}

export async function getDeliveryContext(rawToken: string) {
  const record = await resolveValidToken(rawToken);
  const { order } = record;

  return {
    productLabel: order.product.label,
    amount: order.amount,
    targetUid: order.targetUid,
  };
}

export async function submitCredentials(
  rawToken: string,
  { targetUid, login, password }: { targetUid: string; login: string; password: string }
): Promise<void> {
  // Revalidate from scratch rather than trusting the earlier GET — see architecture doc §4.3.
  const record = await resolveValidToken(rawToken);
  const { order } = record;

  if (targetUid !== order.targetUid) {
    throw new AppError('The confirmed UID does not match this order', 400);
  }
  if (!login || !password) {
    throw new AppError('Login and password are required', 400);
  }

  await orderRepository.createAccountCredential(order.id, {
    loginEncrypted: credentialCrypto.encrypt(login),
    passwordEncrypted: credentialCrypto.encrypt(password),
  });
  await orderRepository.markCredentialTokenUsed(record.id);
  await orderRepository.updateStatus(order.id, 'credentials_received');

  const fresh = await orderRepository.findById(order.id);
  await notificationService.notify('credentials_received', fresh!);
}
