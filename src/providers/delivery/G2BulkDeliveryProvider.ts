import DeliveryProvider, { VerifyPlayerInput, VerifyPlayerResult, DeliverTopUpInput, DeliverTopUpResult } from './DeliveryProvider';
import AppError from '../../utils/AppError';

const BASE_URL = 'https://api.g2bulk.com/v1';

// g2bulk's own game code for checkPlayerId — not the same as our internal Game.code
// ('free_fire'). Verified directly against the real API: "freefire_global" rejects every
// UID (400, valid:"invalid") even for real accounts, only the actual region works —
// matches the single region this project's catalogue sync already uses (see
// prisma/seed.ts's REGION constant).
const FREEFIRE_REGION = 'freefire_me';

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
      body: JSON.stringify({ game: FREEFIRE_REGION, user_id: uid }),
    });

    // An unknown/invalid UID responds 400 with valid:"invalid" — but check the body
    // too (not just the status) in case g2bulk ever returns 200 with valid:"invalid".
    const data = (await response.json().catch(() => null)) as
      | { valid?: string; region?: string; nickname?: string; username?: string }
      | null;

    if (!response.ok || !data || data.valid !== 'valid') {
      throw new AppError('Player not found for this UID', 404);
    }

    // No "level" field exists in the real response — region does, under the same name.
    return { pseudo: data.nickname || data.username || uid, region: data.region };
  }

  async deliverTopUp({ uid, supplierRef }: DeliverTopUpInput): Promise<DeliverTopUpResult> {
    // supplierRef is g2bulk's own raw catalogue id (SupplierCatalogEntry.supplierRef) —
    // never our internal Product.externalRef, which g2bulk has no way to recognize.
    const response = await fetch(`${BASE_URL}/games/free_fire/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ uid, productRef: supplierRef }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(`G2Bulk delivery failed (${response.status}): ${errorBody}`, 502);
    }

    const data = (await response.json()) as { status: string };
    return { success: data.status === 'COMPLETED', raw: data };
  }
}
