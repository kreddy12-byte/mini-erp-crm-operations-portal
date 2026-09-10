import type { Request, Response } from 'express';
import {
  GENERIC_RESET_MESSAGE,
  GENERIC_VERIFY_MESSAGE,
  loginUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signInWithGoogle,
  signupUser,
  verifyEmail,
} from '../services/auth.service';
import { AppError, ErrorCodes } from '../utils/app-error';
import { sendSuccess } from '../utils/http';
import {
  parseEmailBody,
  parseGoogleAuthBody,
  parseLoginBody,
  parseResetPasswordBody,
  parseSignupBody,
  parseTokenBody,
} from '../validators/auth.validator';

export async function login(req: Request, res: Response): Promise<void> {
  const credentials = parseLoginBody(req.body);
  const data = await loginUser(credentials.email, credentials.password);
  sendSuccess(res, data, 'Login successful');
}

export async function signup(req: Request, res: Response): Promise<void> {
  const input = parseSignupBody(req.body);
  const data = await signupUser(input);
  sendSuccess(res, data, 'Check your email to verify your account.', 201);
}

export async function verifyEmailAddress(req: Request, res: Response): Promise<void> {
  const { token } = parseTokenBody(req.body);
  const data = await verifyEmail(token);
  sendSuccess(res, data, 'Email verified');
}

export async function resendVerificationEmail(req: Request, res: Response): Promise<void> {
  const { email } = parseEmailBody(req.body);
  await resendVerification(email);
  sendSuccess(res, { sent: true }, GENERIC_VERIFY_MESSAGE);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = parseEmailBody(req.body);
  await requestPasswordReset(email);
  sendSuccess(res, { sent: true }, GENERIC_RESET_MESSAGE);
}

export async function completePasswordReset(req: Request, res: Response): Promise<void> {
  const input = parseResetPasswordBody(req.body);
  await resetPassword(input.token, input.password);
  sendSuccess(res, { updated: true }, 'Password updated. Sign in with your new password.');
}

export async function google(req: Request, res: Response): Promise<void> {
  const { idToken } = parseGoogleAuthBody(req.body);
  const data = await signInWithGoogle(idToken);
  sendSuccess(res, data, 'Login successful');
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }

  sendSuccess(res, { user: req.auth }, 'Current user');
}
