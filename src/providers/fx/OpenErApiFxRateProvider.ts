import FxRateProvider from './FxRateProvider';

// Free, keyless FX endpoint (https://www.exchangerate-api.com/docs/free) — no account or
// API key needed, which is why it's the live default instead of being gated behind a
// pending-credentials mock like papi.mg/g2bulk.
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

export default class OpenErApiFxRateProvider extends FxRateProvider {
  async getUsdToArRate(): Promise<number> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT);
    } catch (err: any) {
      throw new Error(`Unable to reach open.er-api.com: ${err.message}`);
    }

    if (!response.ok) {
      throw new Error(`open.er-api.com responded with HTTP ${response.status}`);
    }

    const data = (await response.json()) as { rates?: Record<string, number> };
    const rate = data?.rates?.MGA;
    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error('open.er-api.com response did not include a valid MGA rate');
    }

    return rate;
  }
}
