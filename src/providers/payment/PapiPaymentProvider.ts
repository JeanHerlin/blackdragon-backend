import PaymentProvider, { CreatePaymentLinkInput, PaymentLink } from './PaymentProvider';
import AppError from '../../utils/AppError';

const PAPI_ENDPOINT = 'https://app.papi.mg/engine/api/payment-links';

interface PapiConfig {
  apiKey?: string;
  notificationUrl: string;
  // isTestMode per docs.papi.mg: labels the transaction as a test in Papi's dashboard,
  // but mobile money still moves real funds — only card payments (with Papi's own
  // dashboard "Test Mode" toggle + their test card) move no money at all. This flag
  // alone does NOT make mobile-money payments free.
  testMode: boolean;
}

// Real papi.mg integration, per docs.papi.mg/fr/docs/developper-guide/integration-guide.
export default class PapiPaymentProvider extends PaymentProvider {
  private apiKey?: string;
  private notificationUrl: string;
  private testMode: boolean;

  constructor({ apiKey, notificationUrl, testMode }: PapiConfig) {
    super();
    this.apiKey = apiKey;
    this.notificationUrl = notificationUrl;
    this.testMode = testMode;
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
        isTestMode: this.testMode,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(`Papi request failed (${response.status}): ${errorBody}`, 502);
    }

    const data = (await response.json()) as { paymentLink: string; notificationToken?: string };
    return { paymentLink: data.paymentLink, notificationToken: data.notificationToken };
  }
}
