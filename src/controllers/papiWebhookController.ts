import crypto from 'crypto';
import asyncHandler from '../utils/asyncHandler';
import * as orderRepository from '../repositories/orderRepository';
import * as orderService from '../services/orderService';
import env from '../config/env';

// Real papi.mg payment notification — see docs.papi.mg/fr/docs/developper-guide/integration-guide.
// Papi sends this once, when a payment-link's status settles (SUCCESS | PENDING | FAILED).
// Unauthenticated by design, like the Messenger webhook — Papi calls this from the
// outside and never carries our admin JWT. Trust instead comes from two checks: the
// per-transaction notificationToken we stored at link-creation time (always enforced),
// and the X-Papi-Signature header once PAPI_WEBHOOK_SECRET is configured (optional —
// Papi's docs mention the header but not its exact algorithm, so this is opt-in until
// confirmed against a real notification).
export const receive = asyncHandler(async (req, res) => {
  const { paymentStatus, merchantPaymentReference, notificationToken } = req.body;

  console.log(`[papiWebhook] <- reference=${merchantPaymentReference} status=${paymentStatus}`);

  if (!merchantPaymentReference || !paymentStatus) {
    res.status(400).json({ error: 'Missing merchantPaymentReference or paymentStatus' });
    return;
  }

  if (env.papi?.webhookSecret) {
    const signature = req.headers['x-papi-signature'];
    const expected = crypto.createHmac('sha256', env.papi.webhookSecret).update(JSON.stringify(req.body)).digest('hex');
    if (signature !== expected) {
      console.error(`[papiWebhook] signature mismatch for reference=${merchantPaymentReference}`);
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  const payment = await orderRepository.findPaymentByReference(merchantPaymentReference);
  if (!payment) {
    console.error(`[papiWebhook] unknown reference=${merchantPaymentReference}`);
    res.status(404).json({ error: 'Unknown reference' });
    return;
  }

  if (payment.notificationToken && payment.notificationToken !== notificationToken) {
    console.error(`[papiWebhook] notificationToken mismatch for reference=${merchantPaymentReference}`);
    res.status(401).json({ error: 'Token mismatch' });
    return;
  }

  // Only a final status needs acting on — see confirmPayment, which transitions the
  // order either way. A PENDING notification (intermediate mobile-money state) is just
  // acknowledged; the order stays as-is until the final SUCCESS/FAILED call arrives.
  if (paymentStatus === 'PENDING') {
    res.status(200).json({ received: true });
    return;
  }

  await orderService.confirmPayment(merchantPaymentReference, paymentStatus === 'SUCCESS' ? 'success' : 'failure');
  res.status(200).json({ received: true });
});
