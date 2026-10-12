export interface CreatePaymentLinkInput {
  reference: string;
  amount: number;
  description: string;
  clientName?: string;
}

export interface PaymentLink {
  paymentLink: string;
  // papi-only — stored on the Payment row and re-checked against the webhook payload
  // before trusting it (see papiWebhookController).
  notificationToken?: string;
}

export default abstract class PaymentProvider {
  abstract createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink>;
}
