import express from 'express';
import * as controller from '../controllers/adminSettingsController';

const router = express.Router();

router.get('/', controller.getSettings);
router.post('/exchange-rate/sync', controller.syncExchangeRate);
router.patch('/admin-status', controller.updateAdminStatus);

export default router;
