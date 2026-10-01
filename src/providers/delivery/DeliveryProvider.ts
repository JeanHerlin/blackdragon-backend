import type { Product } from '@prisma/client';

export interface VerifyPlayerInput {
  gameCode?: string;
  uid: string;
}

export interface VerifyPlayerResult {
  pseudo: string;
}

export interface DeliverTopUpInput {
  gameCode?: string;
  uid: string;
  product: Product;
}

export interface DeliverTopUpResult {
  success: boolean;
  raw?: unknown;
}

export default abstract class DeliveryProvider {
  abstract verifyPlayer(input: VerifyPlayerInput): Promise<VerifyPlayerResult>;
  abstract deliverTopUp(input: DeliverTopUpInput): Promise<DeliverTopUpResult>;
}
