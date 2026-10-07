import express from 'express';
import * as controller from '../controllers/debugPapiWebhookController';

const router = express.Router();

// Unauthenticated, like the real papi webhook will be — papi calls this from the
// outside, it never carries our admin JWT.
router.all('/', controller.capture);

export default router;
