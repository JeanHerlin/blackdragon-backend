import DeliveryProvider, { VerifyPlayerInput, VerifyPlayerResult, DeliverTopUpInput, DeliverTopUpResult } from './DeliveryProvider';
import AppError from '../../utils/AppError';

const BASE_URL = 'https://api.g2bulk.com/v1';

interface G2BulkConfig {
  apiKey?: string;
}

// Real g2bulk.com integration, per api.g2bulk.com/docs — inactive until
// DELIVERY_PROVIDER=g2bulk and a real key are set. Not exercised by any test yet.
export default class G2BulkDeliveryProvider extends DeliveryProvider {
  private apiKey: string;

  constructor({ apiKey }: G2BulkConfig) {
    super();
    this.apiKey = apiKey ?? '';
  }

  async verifyPlayer({ uid }: VerifyPlayerInput): Promise<VerifyPlayerResult> {
    const response = await fetch(`${BASE_URL}/games/checkPlayerId`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ game: 'free_fire', uid }),
    });

    if (!response.ok) {
      throw new AppError('Player not found for this UID', 404);
    }
    const data = (await response.json()) as { pseudo: string };
    return { pseudo: data.pseudo };
  }

  async deliverTopUp({ uid, product }: DeliverTopUpInput): Promise<DeliverTopUpResult> {
    const response = await fetch(`${BASE_URL}/games/free_fire/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ uid, productRef: product.externalRef }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(`G2Bulk delivery failed (${response.status}): ${errorBody}`, 502);
    }

    const data = (await response.json()) as { status: string };
    return { success: data.status === 'COMPLETED', raw: data };
  }
}
