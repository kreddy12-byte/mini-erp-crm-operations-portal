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
  CONFLICT: 'CONFLICT',
  DUPLICATE_SKU: 'DUPLICATE_SKU',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
