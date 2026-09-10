import { AppError, ErrorCodes } from '../utils/app-error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 10;
const MAX_NAME = 80;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface EmailOnlyInput {
  email: string;
}

export interface TokenInput {
  token: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface GoogleAuthInput {
  idToken: string;
}

function asRecord(body: unknown, message: string): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, message);
  }
  return body as Record<string, unknown>;
}

export function parseEmail(value: unknown, field = 'A valid email address'): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is required.`);
  }
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 160) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A valid email address is required.');
  }
  return email;
}

export function parsePassword(value: unknown, { requiredStrength }: { requiredStrength: boolean }): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password is required.');
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password is too long.');
  }
  if (requiredStrength) {
    if (value.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password must be at least 10 characters.');
    }
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password must include a letter and a number.');
    }
  }
  return value;
}

export function parseLoginBody(body: unknown): LoginCredentials {
  const record = asRecord(body, 'Email and password are required.');
  return {
    email: parseEmail(record.email),
    password: parsePassword(record.password, { requiredStrength: false }),
  };
}

export function parseSignupBody(body: unknown): SignupInput {
  const record = asRecord(body, 'Account details are required.');
  if (typeof record.name !== 'string' || record.name.trim().length < 2) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Full name is required.');
  }
  const name = record.name.trim();
  if (name.length > MAX_NAME) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Full name is too long.');
  }

  const password = parsePassword(record.password, { requiredStrength: true });
  if (typeof record.confirmPassword !== 'string' || record.confirmPassword !== password) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password confirmation does not match.');
  }

  // Public signup never accepts a role from the client. Role is assigned in the service.
  return {
    name,
    email: parseEmail(record.email),
    password,
  };
}

export function parseEmailBody(body: unknown): EmailOnlyInput {
  const record = asRecord(body, 'Email is required.');
  return { email: parseEmail(record.email) };
}

export function parseTokenBody(body: unknown): TokenInput {
  const record = asRecord(body, 'A verification token is required.');
  if (typeof record.token !== 'string' || record.token.trim().length < 16) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A valid token is required.');
  }
  return { token: record.token.trim() };
}

export function parseResetPasswordBody(body: unknown): ResetPasswordInput {
  const record = asRecord(body, 'Reset details are required.');
  const password = parsePassword(record.password, { requiredStrength: true });
  if (typeof record.confirmPassword !== 'string' || record.confirmPassword !== password) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Password confirmation does not match.');
  }
  if (typeof record.token !== 'string' || record.token.trim().length < 16) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A valid token is required.');
  }
  return { token: record.token.trim(), password };
}

export function parseGoogleAuthBody(body: unknown): GoogleAuthInput {
  const record = asRecord(body, 'Google sign-in details are required.');
  if (typeof record.idToken !== 'string' || record.idToken.trim().length < 20) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A Google identity token is required.');
  }
  return { idToken: record.idToken.trim() };
}
