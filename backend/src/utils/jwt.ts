import type { UserRole } from '@prisma/client';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { AccessTokenClaims } from '../types/auth';
import { AppError, ErrorCodes } from './app-error';

const USER_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS']);

const INVALID_SESSION = new AppError(
  401,
  ErrorCodes.UNAUTHORIZED,
  'Your session is invalid or has expired.',
);

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.has(value);
}

export function signAccessToken(userId: string, role: UserRole, tokenVersion: number): string {
  const payload: AccessTokenClaims = { sub: userId, role, tokenVersion };
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null) {
      throw INVALID_SESSION;
    }

    const { sub, role, tokenVersion } = decoded;
    if (typeof sub !== 'string' || sub.length === 0 || !isUserRole(role)) {
      throw INVALID_SESSION;
    }

    const version = typeof tokenVersion === 'number' && Number.isInteger(tokenVersion) ? tokenVersion : 0;
    return { sub, role, tokenVersion: version };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    // Map expired, malformed, and invalid signatures to the same client message.
    throw INVALID_SESSION;
  }
}
