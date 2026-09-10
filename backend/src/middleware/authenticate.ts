import type { Request, Response, NextFunction } from 'express';
import { findPublicUserById } from '../repositories/users.repository';
import { AppError, ErrorCodes } from '../utils/app-error';
import { asyncHandler } from '../utils/async-handler';
import { verifyAccessToken } from '../utils/jwt';

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.get('authorization');
  if (!header) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }

  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }

  const claims = verifyAccessToken(match[1]);
  const user = await findPublicUserById(claims.sub);
  if (!user) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }

  req.auth = user;
  next();
});
