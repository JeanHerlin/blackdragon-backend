import express from 'express';
import * as controller from '../controllers/adminPushController';

const router = express.Router();

router.get('/public-key', controller.getPublicKey);
router.post('/subscribe', controller.subscribe);
router.delete('/subscribe', controller.unsubscribe);

export default router;
