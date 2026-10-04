import express from 'express';
import * as webhookController from './webhookController';

const router = express.Router();

// Unauthenticated by design — Facebook calls these directly. Integrity comes from the
// verify-token handshake (GET) and the signature check on every payload (POST), not a JWT.
router.get('/', webhookController.verify);
router.post('/', webhookController.receive);

export default router;
