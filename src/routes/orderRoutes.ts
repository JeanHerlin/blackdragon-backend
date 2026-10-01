import express from 'express';
import * as controller from '../controllers/orderController';

const router = express.Router();

router.post('/', controller.createOrder);
router.get('/:id', controller.getOrder);

export default router;
