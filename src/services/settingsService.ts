import AppError from '../utils/AppError';
import * as settingsRepository from '../repositories/settingsRepository';

export function getSettings() {
  return settingsRepository.getSettings();
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
