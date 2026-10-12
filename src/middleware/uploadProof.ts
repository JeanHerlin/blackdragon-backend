import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

// Separate from upload.ts's product-image storage — these come from unauthenticated
// customers (payment proof screenshots), so they get their own directory rather than
// sharing one with admin-managed product assets.
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'proofs');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED_MIME_TYPES[file.mimetype]}`),
});

const uploadProofImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new Error('Only PNG, JPEG or WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});

export { UPLOADS_DIR };
export default uploadProofImage;
