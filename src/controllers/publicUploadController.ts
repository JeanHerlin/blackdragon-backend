import type { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';
import uploadProofImage from '../middleware/uploadProof';
import storageProvider from '../providers/storage';

// Unauthenticated by design — the customer submitting a cashpoint proof has no admin
// session. multer reports file-type/size problems via its own callback, not a thrown
// AppError — mapped here so the customer sees a clear message instead of a raw 500.
export function handleProofImageUpload(req: Request, res: Response, next: NextFunction): void {
  uploadProofImage.single('image')(req, res, async (err: unknown) => {
    if (err) {
      next(new AppError(err instanceof Error ? err.message : 'Image upload failed', 400));
      return;
    }
    if (!req.file) {
      next(new AppError('No image file was provided', 400));
      return;
    }

    try {
      const { url } = await storageProvider.uploadImage({ buffer: req.file.buffer, folder: 'proofs' });
      res.status(201).json({ url });
    } catch (uploadErr) {
      next(uploadErr);
    }
  });
}
