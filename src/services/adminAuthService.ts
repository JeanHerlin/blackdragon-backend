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
  // The email the admin typed when requesting the link — captured here rather than at
  // reset time so the existing forgot-password form (single email field) can double as
  // "what email do you want going forward", with no frontend change needed.
  newEmail: string;
}

// Single admin, single active reset flow at a time — a new request simply overwrites
// the previous token, which is exactly the "one active token" behavior we want.
let activeResetToken: ResetTokenState | null = null;

export async function login({ email, password }: { email: string; password: string }) {
  let admin;
  try {
    admin = adminRepository.getAdmin();
  } catch {
    // No admin.json yet (fresh prod deploy, no account created at all) — same generic
    // message as a wrong password, so this never reveals bootstrap state to a caller.
    throw new AppError('Invalid email or password', 401);
  }

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

// This is also how the very first admin account gets created in production: there is
// no separate CLI seed step — whoever controls the fixed recovery inbox (see
// ADMIN_NOTIFICATION_EMAIL) can bootstrap or fully replace the admin identity by
// requesting a reset and completing it. The submitted email does not need to match an
// existing account; it becomes the new login email once the link is completed.
export async function requestPasswordReset({ email }: { email: string }): Promise<void> {
  if (!email || typeof email !== 'string') {
    throw new AppError('email is required', 400);
  }

  const rawToken = generateRawToken();
  activeResetToken = {
    tokenHash: hashToken(rawToken),
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
    used: false,
    newEmail: email,
  };

  const resetLink = `${env.frontendUrl}/admin/reset-password?token=${rawToken}`;

  await emailProvider.sendEmail({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: 'Black Dragon FF — Réinitialisation des identifiants admin',
    htmlContent: `
      <p>Une demande de réinitialisation des identifiants admin a été effectuée pour l'adresse : <strong>${email}</strong>.</p>
      <p><a href="${resetLink}">Cliquez ici pour définir le nouveau mot de passe</a></p>
      <p>En validant ce lien, cette adresse et le mot de passe choisi remplaceront les identifiants admin actuels.</p>
      <p>Ce lien expire dans 30 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email — rien ne change tant que le lien n'est pas validé.</p>
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
  // Replaces the admin record outright (email included) rather than only updating the
  // password on the existing one — see function comment above.
  adminRepository.writeAdmin({ email: activeResetToken.newEmail, passwordHash });
  activeResetToken.used = true;
}

export async function getProfile(email: string) {
  const admin = adminRepository.getAdmin();
  if (email !== admin.email) {
    throw new AppError('Admin not found', 404);
  }
  return { email: admin.email };
}
