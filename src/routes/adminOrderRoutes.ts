import express from 'express';
import * as controller from '../controllers/adminOrderController';

const router = express.Router();

router.get('/', controller.listOrders);
router.get('/:id', controller.getOrder);
router.post('/:id/retry-delivery', controller.retryDelivery);
router.post('/:id/manual-deliver', controller.markManualDelivered);
router.get('/:id/credentials', controller.getCredentials);
router.get('/:id/cashpoint-proof', controller.getCashpointProof);
router.post('/:id/reject', controller.rejectOrder);
router.post('/:id/flag-issue', controller.flagIssue);
router.post('/:id/resolve-issue', controller.resolveIssue);
router.post('/:id/cashpoint/confirm', controller.confirmCashpointPayment);
router.post('/:id/cashpoint/reject', controller.rejectCashpointPayment);
router.post('/:id/launch-delivery', controller.launchG2bulkDelivery);

export default router;
