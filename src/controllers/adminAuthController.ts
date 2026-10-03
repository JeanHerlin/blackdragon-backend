import asyncHandler from '../utils/asyncHandler';
import * as adminAuthService from '../services/adminAuthService';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await adminAuthService.login({ email, password });
  res.json(result);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await adminAuthService.requestPasswordReset({ email });
  // The submitted email isn't checked against anything — see service layer — so the
  // response is deliberately generic regardless of what was typed.
  res.json({ message: 'If this email is registered, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  await adminAuthService.resetPassword({ token, newPassword });
  res.json({ message: 'Password updated successfully.' });
});

export const me = asyncHandler(async (req, res) => {
  const profile = await adminAuthService.getProfile(req.admin!.email);
  res.json(profile);
});
