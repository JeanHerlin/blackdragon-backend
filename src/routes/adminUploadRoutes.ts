import express from 'express';
import { handleImageUpload } from '../controllers/adminUploadController';

const router = express.Router();

router.post('/image', handleImageUpload);

export default router;
