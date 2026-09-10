import type { Request, Response } from 'express';
import { loginUser } from '../services/auth.service';
import { AppError, ErrorCodes } from '../utils/app-error';
import { sendSuccess } from '../utils/http';
import { parseLoginBody } from '../validators/auth.validator';

export async function login(req: Request, res: Response): Promise<void> {
  // 1. VALIDATE REQUEST
  const credentials = parseLoginBody(req.body);

  // 2. AUTHENTICATE AND ISSUE TOKEN
  const data = await loginUser(credentials.email, credentials.password);

  sendSuccess(res, data, 'Login successful');
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }

  sendSuccess(res, { user: req.auth }, 'Current user');
}
