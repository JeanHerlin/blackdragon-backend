import express from 'express';
import authenticate from '../middleware/authenticate';

import adminAuthRoutes from './adminAuthRoutes';
import catalogRoutes from './catalogRoutes';
import orderRoutes from './orderRoutes';
import publicRoutes from './publicRoutes';
import adminOrderRoutes from './adminOrderRoutes';
import adminCatalogRoutes from './adminCatalogRoutes';
import adminSettingsRoutes from './adminSettingsRoutes';
import adminCategoryRoutes from './adminCategoryRoutes';
import adminUploadRoutes from './adminUploadRoutes';
import adminPushRoutes from './adminPushRoutes';
import adminPromoCodeRoutes from './adminPromoCodeRoutes';
import messengerRoutes from '../adapters/messenger/messengerRoutes';
import debugPapiWebhookRoutes from './debugPapiWebhookRoutes';
import * as adminStatsController from '../controllers/adminStatsController';

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/admin/auth', adminAuthRoutes);
router.use('/catalog', catalogRoutes);
router.use('/orders', orderRoutes);
router.use('/public', publicRoutes);
router.use('/webhooks/messenger', messengerRoutes);
router.use('/webhooks/papi', debugPapiWebhookRoutes);

router.use('/admin/orders', authenticate, adminOrderRoutes);
router.use('/admin/products', authenticate, adminCatalogRoutes);
router.use('/admin/settings', authenticate, adminSettingsRoutes);
router.use('/admin/catalog', authenticate, adminCategoryRoutes);
router.use('/admin/uploads', authenticate, adminUploadRoutes);
router.use('/admin/push', authenticate, adminPushRoutes);
router.use('/admin/promo-codes', authenticate, adminPromoCodeRoutes);
router.get('/admin/stats', authenticate, adminStatsController.getDashboardStats);

export default router;
