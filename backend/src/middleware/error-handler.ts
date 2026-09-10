import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env';
import { AppError, ErrorCodes } from '../utils/app-error';
import type { ApiErrorBody } from '../types/api';

function isJsonSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError && 'body' in error;
}

function toSafeClientError(error: unknown): { statusCode: number; body: ApiErrorBody } {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  if (isJsonSyntaxError(error)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: ErrorCodes.INVALID_JSON,
          message: 'Request body must be valid JSON.',
        },
      },
    };
  }

  // Unknown errors must never leak stack traces, paths, or internals.
  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'An unexpected error occurred. Please try again.',
      },
    },
  };
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const { statusCode, body } = toSafeClientError(error);

  if (error instanceof AppError) {
    if (env.isDevelopment && error.statusCode >= 500) {
      console.error(error);
    }
  } else if (env.isDevelopment) {
    console.error(error);
  } else {
    console.error('Unhandled API error');
  }

  res.status(statusCode).json(body);
};
