import multer from 'multer';
import env from '../config/env';

// Separate instance from upload.ts's product-image middleware purely for the "unauthenticated
// customer" comment trail at the controller level — same memory-storage + limits otherwise.
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const uploadProofImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxSizeBytes },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only PNG, JPEG or WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});

export default uploadProofImage;
