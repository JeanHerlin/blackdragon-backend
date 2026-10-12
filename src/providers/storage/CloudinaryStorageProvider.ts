import { v2 as cloudinary } from 'cloudinary';
import StorageProvider, { UploadImageInput, UploadImageResult } from './StorageProvider';
import AppError from '../../utils/AppError';

interface CloudinaryConfig {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
}

// Required on a serverless/read-only filesystem (Vercel) — see StorageProvider's folder
// comment for why products/proofs stay separate (mirrors Cloudinary's own folder concept).
export default class CloudinaryStorageProvider extends StorageProvider {
  constructor({ cloudName, apiKey, apiSecret }: CloudinaryConfig) {
    super();
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  async uploadImage({ buffer, folder }: UploadImageInput): Promise<UploadImageResult> {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: `blackdragon-ff/${folder}` }, (err, res) => {
        if (err || !res) {
          reject(new AppError(`Cloudinary upload failed: ${err?.message || 'unknown error'}`, 502));
          return;
        }
        resolve(res as { secure_url: string });
      });
      stream.end(buffer);
    });

    return { url: result.secure_url };
  }
}
