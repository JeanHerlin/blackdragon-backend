import PaymentProvider, { CreatePaymentLinkInput, PaymentLink } from './PaymentProvider';
import AppError from '../../utils/AppError';

const PAPI_ENDPOINT = 'https://app.papi.mg/engine/api/payment-links';

interface PapiConfig {
  apiKey?: string;
  notificationUrl: string;
}

// Real papi.mg integration, per docs.papi.mg — inactive until PAYMENT_PROVIDER=papi and
// a real token are set. Not exercised by any test in this codebase yet (no key available).
export default class PapiPaymentProvider extends PaymentProvider {
  private apiKey?: string;
  private notificationUrl: string;

  constructor({ apiKey, notificationUrl }: PapiConfig) {
    super();
    this.apiKey = apiKey;
    this.notificationUrl = notificationUrl;
  }

  async createPaymentLink({ reference, amount, description, clientName }: CreatePaymentLinkInput): Promise<PaymentLink> {
    const response = await fetch(PAPI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: this.apiKey ?? '' },
      body: JSON.stringify({
        reference,
        amount,
        description,
        clientName: clientName || 'Client',
        notificationUrl: this.notificationUrl,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(`Papi request failed (${response.status}): ${errorBody}`, 502);
    }

    const data = (await response.json()) as { paymentLink: string };
    return { paymentLink: data.paymentLink };
  }
}
