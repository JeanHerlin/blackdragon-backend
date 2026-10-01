import express from 'express';
import authenticate from '../middleware/authenticate';
import * as controller from '../controllers/adminAuthController';

const router = express.Router();

router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);
router.get('/me', authenticate, controller.me);

export default router;
