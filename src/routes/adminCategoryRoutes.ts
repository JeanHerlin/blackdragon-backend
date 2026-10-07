import express from 'express';
import * as controller from '../controllers/adminCategoryController';

const router = express.Router();

router.get('/:categoryCode/dashboard', controller.getDashboard);
router.get('/:categoryCode/supplier-options', controller.listSupplierOptions);
router.post('/:categoryCode/products', controller.createProduct);
router.post('/:categoryCode/products/manual', controller.createManualProduct);
router.post('/:categoryCode/products/bundle', controller.createBundleProduct);
router.patch('/:categoryCode/products/:productId', controller.updateProduct);
router.delete('/:categoryCode/products/:productId', controller.deleteProduct);
router.delete('/:categoryCode/products/:productId/bundle-items/:bundleItemId', controller.removeBundleItem);

export default router;
