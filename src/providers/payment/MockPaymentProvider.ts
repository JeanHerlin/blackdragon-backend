import PaymentProvider, { CreatePaymentLinkInput, PaymentLink } from './PaymentProvider';
import env from '../../config/env';

// No real money moves. The "payment link" is our own confirm page where a human
// (dev, tester, or a demo) clicks through the two possible outcomes — this is what
// makes payment success/failure simulatable without papi.mg credentials.
export default class MockPaymentProvider extends PaymentProvider {
  async createPaymentLink({ reference }: CreatePaymentLinkInput): Promise<PaymentLink> {
    return { paymentLink: `${env.frontendUrl}/pay/${reference}` };
  }
}
