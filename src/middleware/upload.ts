import multer from 'multer';
import env from '../config/env';

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Memory storage, not disk — the file goes straight to the configured StorageProvider
// (Cloudinary in production; see providers/storage) as a buffer, never touching the
// filesystem, so this works unchanged on a read-only serverless deploy.
const uploadImage = multer({
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

export default uploadImage;
