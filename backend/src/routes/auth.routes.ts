import { Router } from 'express';
import {
  completePasswordReset,
  forgotPassword,
  getMe,
  google,
  login,
  resendVerificationEmail,
  signup,
  verifyEmailAddress,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/async-handler';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(login));
authRouter.post('/signup', asyncHandler(signup));
authRouter.post('/verify-email', asyncHandler(verifyEmailAddress));
authRouter.post('/resend-verification', asyncHandler(resendVerificationEmail));
authRouter.post('/forgot-password', asyncHandler(forgotPassword));
authRouter.post('/reset-password', asyncHandler(completePasswordReset));
authRouter.post('/google', asyncHandler(google));
authRouter.get('/me', authenticate, asyncHandler(getMe));
