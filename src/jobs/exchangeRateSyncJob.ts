import cron from 'node-cron';
import fxRateProvider from '../providers/fx';
import * as settingsService from '../services/settingsService';

async function syncExchangeRate(): Promise<void> {
  try {
    const rate = await fxRateProvider.getUsdToArRate();
    await settingsService.updateUsdToArRate(rate);
    console.log(`[exchangeRateSync] usdToArRate updated to ${rate}`);
  } catch (err: any) {
    // Keep the last known-good rate on failure rather than writing a bad/zero value —
    // a stale rate is recoverable next run, a corrupted one isn't until noticed.
    console.error(`[exchangeRateSync] failed, keeping previous rate: ${err.message}`);
  }
}

export function startExchangeRateSync(): void {
  syncExchangeRate();
  cron.schedule('0 */6 * * *', syncExchangeRate);
}
