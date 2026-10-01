import app from './app';
import env from './config/env';
import { startExchangeRateSync } from './jobs/exchangeRateSyncJob';

app.listen(env.port, () => {
  console.log(`Black Dragon FF API listening on port ${env.port}`);
  startExchangeRateSync();
});
