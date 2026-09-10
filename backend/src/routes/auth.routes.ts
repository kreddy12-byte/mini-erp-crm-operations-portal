import { Router } from 'express';
import { getMe, login } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/async-handler';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(login));
authRouter.get('/me', authenticate, asyncHandler(getMe));
