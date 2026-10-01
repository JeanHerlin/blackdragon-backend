export interface CreatePaymentLinkInput {
  reference: string;
  amount: number;
  description: string;
  clientName?: string;
}

export interface PaymentLink {
  paymentLink: string;
}

export default abstract class PaymentProvider {
  abstract createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink>;
}
