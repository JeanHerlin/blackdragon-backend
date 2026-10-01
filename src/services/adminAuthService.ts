import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import env from '../config/env';
import AppError from '../utils/AppError';
import * as adminRepository from '../repositories/adminRepository';
import emailProvider from '../providers/email';
import { generateRawToken, hashToken } from '../utils/secureToken';
import { ADMIN_NOTIFICATION_EMAIL } from '../config/constants';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

interface ResetTokenState {
  tokenHash: string;
  expiresAt: number;
  used: boolean;
}

// Single admin, single active reset flow at a time — a new request simply overwrites
// the previous token, which is exactly the "one active token" behavior we want.
let activeResetToken: ResetTokenState | null = null;

export async function login({ email, password }: { email: string; password: string }) {
  const admin = adminRepository.getAdmin();

  if (email !== admin.email) {
    throw new AppError('Invalid email or password', 401);
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatches) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = jwt.sign({ sub: admin.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  return { token, email: admin.email };
}

export async function requestPasswordReset({ email }: { email: string }): Promise<void> {
  const admin = adminRepository.getAdmin();

  // Silently no-op on a mismatched email: this is a public endpoint, and we don't
  // want it to reveal whether a given address is the admin's or trigger unwanted emails.
  if (email !== admin.email) {
    return;
  }

  const rawToken = generateRawToken();
  activeResetToken = {
    tokenHash: hashToken(rawToken),
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
    used: false,
  };

  const resetLink = `${env.frontendUrl}/admin/reset-password?token=${rawToken}`;

  await emailProvider.sendEmail({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: 'Black Dragon FF — Réinitialisation du mot de passe admin',
    htmlContent: `
      <p>Une demande de réinitialisation du mot de passe admin a été effectuée.</p>
      <p><a href="${resetLink}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 30 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
    `,
  });
}

export async function resetPassword({ token, newPassword }: { token: string; newPassword: string }): Promise<void> {
  if (!activeResetToken) {
    throw new AppError('This reset link is invalid or has expired', 400);
  }

  const isSameToken = activeResetToken.tokenHash === hashToken(token);
  const isExpired = Date.now() > activeResetToken.expiresAt;

  if (!isSameToken || activeResetToken.used || isExpired) {
    throw new AppError('This reset link is invalid or has expired', 400);
  }

  if (!newPassword || newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  adminRepository.updatePasswordHash(passwordHash);
  activeResetToken.used = true;
}

export async function getProfile(email: string) {
  const admin = adminRepository.getAdmin();
  if (email !== admin.email) {
    throw new AppError('Admin not found', 404);
  }
  return { email: admin.email };
}
