import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../utils/app-error';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError(
      404,
      ErrorCodes.NOT_FOUND,
      `The requested resource ${req.method} ${req.path} was not found.`,
    ),
  );
}
