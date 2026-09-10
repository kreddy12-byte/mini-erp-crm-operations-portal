import type { UserRole } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../utils/app-error';

export function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.'));
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(
        new AppError(
          403,
          ErrorCodes.FORBIDDEN,
          'You do not have permission to perform this action.',
        ),
      );
      return;
    }

    next();
  };
}
