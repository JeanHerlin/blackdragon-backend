import express from 'express';
import * as controller from '../controllers/catalogController';

const router = express.Router();

router.get('/games', controller.listGames);
router.get('/categories', controller.listCategories);
router.get('/products', controller.listProducts);
router.get('/types', controller.listProductTypes);

export default router;
