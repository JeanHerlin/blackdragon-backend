import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import StorageProvider, { UploadImageInput, UploadImageResult } from './StorageProvider';

// Local-disk fallback for offline dev — never used once STORAGE_PROVIDER=cloudinary is
// set (required in production: a serverless deploy's filesystem is read-only and the
// 'uploads/' directory never survives a cold start, see CloudinaryStorageProvider).
export default class LocalStorageProvider extends StorageProvider {
  // Built from env.apiPublicUrl rather than the request's own host/protocol — stays
  // correct regardless of which tunnel/proxy a given request happens to arrive through.
  constructor(private apiPublicUrl: string) {
    super();
  }

  async uploadImage({ buffer, folder }: UploadImageInput): Promise<UploadImageResult> {
    const dir = path.join(__dirname, '..', '..', '..', 'uploads', folder);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${crypto.randomUUID()}.jpg`;
    fs.writeFileSync(path.join(dir, filename), buffer);

    return { url: `${this.apiPublicUrl}/uploads/${folder}/${filename}` };
  }
}
