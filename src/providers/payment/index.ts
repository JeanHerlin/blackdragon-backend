import env from '../../config/env';
import MockPaymentProvider from './MockPaymentProvider';
import PapiPaymentProvider from './PapiPaymentProvider';

const paymentProvider =
  env.paymentProvider === 'papi'
    ? new PapiPaymentProvider({ apiKey: env.papi?.apiKey, notificationUrl: `${env.apiPublicUrl}/webhooks/papi` })
    : new MockPaymentProvider();

export default paymentProvider;
