import express from 'express';
import * as controller from '../controllers/adminPromoCodeController';

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.delete('/:id', controller.remove);
router.patch('/:id/active', controller.setActive);
router.post('/:id/products', controller.attach);
router.delete('/:id/products/:productId', controller.detach);
router.post('/:id/products/all', controller.attachAll);
router.delete('/:id/products', controller.detachAll);

export default router;
