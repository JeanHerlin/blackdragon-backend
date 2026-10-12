import express from 'express';
import * as orderController from '../controllers/orderController';
import * as credentialDeliveryController from '../controllers/credentialDeliveryController';
import * as paymentProofController from '../controllers/paymentProofController';
import { handleProofImageUpload } from '../controllers/publicUploadController';

const router = express.Router();

// Mock payment confirm page (stands in for the real papi.mg checkout + webhook).
router.get('/payments/:reference', orderController.getPaymentContext);
router.post('/payments/:reference/confirm', orderController.confirmPayment);

// Account-credential delivery form — see architecture doc §4, credential-token skill note.
router.get('/deliver/:token', credentialDeliveryController.getContext);
router.post('/deliver/:token', credentialDeliveryController.submit);

// Cashpoint proof-submission form — same token-protected pattern as /deliver above.
router.get('/pay-proof/:token', paymentProofController.getContext);
router.post('/pay-proof/:token', paymentProofController.submit);
router.post('/uploads/proof-image', handleProofImageUpload);

export default router;
