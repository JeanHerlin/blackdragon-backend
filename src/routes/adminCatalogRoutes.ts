import express from 'express';
import * as controller from '../controllers/adminCatalogController';

const router = express.Router();

router.get('/', controller.listProductsGrouped);
router.patch('/:id/price', controller.updatePrice);
router.get('/g2bulk-catalog', controller.listSupplierCatalog);
router.post('/g2bulk-catalog/sync', controller.syncSupplierCatalog);

export default router;
