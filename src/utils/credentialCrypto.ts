import crypto from 'crypto';
import env from '../config/env';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(env.encryptionKey, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // iv + authTag + ciphertext, all base64 in one string so it's a single DB column.
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(payload: string): string {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const key = Buffer.from(env.encryptionKey, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
