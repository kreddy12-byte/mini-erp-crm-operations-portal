export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_NOT_CONFIGURED: 'EMAIL_NOT_CONFIGURED',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  INVALID_TOKEN: 'INVALID_TOKEN',
  GOOGLE_AUTH_FAILED: 'GOOGLE_AUTH_FAILED',
  GOOGLE_NOT_CONFIGURED: 'GOOGLE_NOT_CONFIGURED',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  DUPLICATE_SKU: 'DUPLICATE_SKU',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
