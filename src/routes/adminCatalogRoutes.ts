import express from 'express';
import * as controller from '../controllers/adminCatalogController';

const router = express.Router();

router.get('/', controller.listProductsGrouped);
router.patch('/:id/price', controller.updatePrice);

export default router;
