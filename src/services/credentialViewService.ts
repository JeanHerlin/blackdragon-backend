import AppError from '../utils/AppError';
import * as orderRepository from '../repositories/orderRepository';
import * as credentialCrypto from '../utils/credentialCrypto';

// Every decryption is a deliberate, audited action (viewedAt), never shown inline in a
// list — see backoffice-ux skill and architecture doc §12 (credentials_access_log).
export async function revealCredentials(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order || !order.accountCredential) {
    throw new AppError('No account credentials for this order', 404);
  }

  await orderRepository.markCredentialViewed(orderId);

  return {
    login: credentialCrypto.decrypt(order.accountCredential.loginEncrypted),
    password: credentialCrypto.decrypt(order.accountCredential.passwordEncrypted),
  };
}
