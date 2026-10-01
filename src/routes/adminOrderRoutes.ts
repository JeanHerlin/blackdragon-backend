import express from 'express';
import * as controller from '../controllers/adminOrderController';

const router = express.Router();

router.get('/', controller.listOrders);
router.get('/:id', controller.getOrder);
router.post('/:id/retry-delivery', controller.retryDelivery);
router.post('/:id/manual-deliver', controller.markManualDelivered);
router.get('/:id/credentials', controller.getCredentials);

export default router;
