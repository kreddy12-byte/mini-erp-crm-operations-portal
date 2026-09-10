import { AppError, ErrorCodes } from '../utils/app-error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;

export interface LoginCredentials {
  email: string;
  password: string;
}

export function parseLoginBody(body: unknown): LoginCredentials {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Email and password are required.');
  }

  const record = body as Record<string, unknown>;
  const emailValue = record.email;
  const passwordValue = record.password;

  if (typeof emailValue !== 'string' || emailValue.trim().length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A valid email address is required.');
  }

  const email = emailValue.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A valid email address is required.');
  }

  if (typeof passwordValue !== 'string' || passwordValue.length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password is required.');
  }

  if (passwordValue.length > MAX_PASSWORD_LENGTH) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password is too long.');
  }

  return { email, password: passwordValue };
}
