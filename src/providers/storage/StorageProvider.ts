export interface UploadImageInput {
  buffer: Buffer;
  // Keeps product images and cashpoint proof screenshots in separate spaces, same
  // reasoning as the old uploads/products vs uploads/proofs disk folders.
  folder: 'products' | 'proofs';
}

export interface UploadImageResult {
  url: string;
}

export default abstract class StorageProvider {
  abstract uploadImage(input: UploadImageInput): Promise<UploadImageResult>;
}
