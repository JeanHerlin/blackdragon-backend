export interface VerifyPlayerInput {
  gameCode?: string;
  uid: string;
}

export interface VerifyPlayerResult {
  pseudo: string;
  // Not confirmed in g2bulk's checkPlayerId response — included defensively so the bot
  // can show them to the customer when (if) the API actually returns them, without
  // assuming they're always present.
  region?: string;
  level?: string | number;
}

// One call = one g2bulk catalogue entry delivered — a bundle product calls this once
// per component (see orderService.resolveDeliveryComponents), a normal product once.
// Takes the raw supplierRef directly rather than a Product, since a bundle has no
// single product-level reference to hand over.
export interface DeliverTopUpInput {
  gameCode?: string;
  uid: string;
  supplierRef: string;
}

export interface DeliverTopUpResult {
  success: boolean;
  raw?: unknown;
}

export default abstract class DeliveryProvider {
  abstract verifyPlayer(input: VerifyPlayerInput): Promise<VerifyPlayerResult>;
  abstract deliverTopUp(input: DeliverTopUpInput): Promise<DeliverTopUpResult>;
}
