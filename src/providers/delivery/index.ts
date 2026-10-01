import env from '../../config/env';
import MockDeliveryProvider from './MockDeliveryProvider';
import G2BulkDeliveryProvider from './G2BulkDeliveryProvider';

const deliveryProvider =
  env.deliveryProvider === 'g2bulk' ? new G2BulkDeliveryProvider({ apiKey: env.g2bulk?.apiKey }) : new MockDeliveryProvider();

export default deliveryProvider;
