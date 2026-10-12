import type { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';
import uploadImage from '../middleware/upload';
import storageProvider from '../providers/storage';

// multer reports file-type/size problems via its own callback, not a thrown AppError —
// mapped here so the admin sees a clear message instead of a raw multer/500 error.
export function handleImageUpload(req: Request, res: Response, next: NextFunction): void {
  uploadImage.single('image')(req, res, async (err: unknown) => {
    if (err) {
      next(new AppError(err instanceof Error ? err.message : 'Image upload failed', 400));
      return;
    }
    if (!req.file) {
      next(new AppError('No image file was provided', 400));
      return;
    }

    try {
      const { url } = await storageProvider.uploadImage({ buffer: req.file.buffer, folder: 'products' });
      res.status(201).json({ url });
    } catch (uploadErr) {
      next(uploadErr);
    }
  });
}
