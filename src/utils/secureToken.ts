import crypto from 'crypto';

// Shared by every "public link with expiry" flow (admin password reset, account-credential
// delivery form): generate a raw token to put in the link, store only its hash.
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
