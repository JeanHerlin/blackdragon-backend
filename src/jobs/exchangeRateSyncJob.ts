import cron from 'node-cron';
import fxRateProvider from '../providers/fx';
import * as settingsService from '../services/settingsService';

// Shared by the 6h cron below and the admin's manual "sync now" click — same live
// fetch either way, so the on-demand trigger behaves exactly like the scheduled one.
export async function syncExchangeRateNow() {
  const rate = await fxRateProvider.getUsdToArRate();
  const settings = await settingsService.updateUsdToArRate(rate);
  console.log(`[exchangeRateSync] usdToArRate updated to ${rate}`);
  return settings;
}

function syncExchangeRateQuietly(): void {
  // Keep the last known-good rate on failure rather than writing a bad/zero value —
  // a stale rate is recoverable next run, a corrupted one isn't until noticed.
  syncExchangeRateNow().catch((err: any) => console.error(`[exchangeRateSync] failed, keeping previous rate: ${err.message}`));
}

export function startExchangeRateSync(): void {
  syncExchangeRateQuietly();
  cron.schedule('0 */6 * * *', syncExchangeRateQuietly);
}
