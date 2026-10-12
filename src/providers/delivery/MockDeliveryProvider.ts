import DeliveryProvider, { VerifyPlayerInput, VerifyPlayerResult, DeliverTopUpInput, DeliverTopUpResult } from './DeliveryProvider';
import AppError from '../../utils/AppError';

// Deterministic, not random: a tester controls the outcome by what they type, the same
// way Stripe's test card numbers encode an outcome — no hidden flag to remember.
export default class MockDeliveryProvider extends DeliveryProvider {
  async verifyPlayer({ uid }: VerifyPlayerInput): Promise<VerifyPlayerResult> {
    if (!uid || uid.length < 3) {
      throw new AppError('Player not found for this UID', 404);
    }
    return { pseudo: `Player_${uid.slice(-4)}`, region: 'ID', level: 42 };
  }

  async deliverTopUp({ uid }: DeliverTopUpInput): Promise<DeliverTopUpResult> {
    if (uid.toUpperCase().includes('FAIL')) {
      throw new AppError('Simulated delivery failure (UID contains "FAIL")', 502);
    }
    return { success: true, raw: { simulated: true } };
  }
}
