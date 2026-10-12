import AppError from '../utils/AppError';
import * as settingsRepository from '../repositories/settingsRepository';
import * as orderRepository from '../repositories/orderRepository';

// Merges in the PWA badge's notification counts so the frontend's single settings poll
// (already hitting every admin page via DashboardHeader) can drive both the admin
// toggle and the app icon badge, without a second endpoint.
export async function getSettings() {
  const [settings, pendingCompteAttention, uidDeliveryFailed, uidCashpointPending] = await Promise.all([
    settingsRepository.getSettings(),
    orderRepository.countNeedsAttention('compte'),
    orderRepository.countUidDeliveryFailed(),
    orderRepository.countUidCashpointProofPending(),
  ]);
  return { ...settings, pendingCompteAttention, uidDeliveryFailed, uidCashpointPending };
}

export function updateUsdToArRate(rate: number) {
  if (typeof rate !== 'number' || rate <= 0) {
    throw new AppError('usdToArRate must be a positive number', 400);
  }
  return settingsRepository.updateUsdToArRate(rate);
}

export function updateAdminActive(isAdminActive: boolean) {
  if (typeof isAdminActive !== 'boolean') {
    throw new AppError('isAdminActive must be a boolean', 400);
  }
  return settingsRepository.updateAdminActive(isAdminActive);
}
