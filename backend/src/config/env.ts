import dotenv from 'dotenv';
import path from 'node:path';

// Load from the process working directory so `npm run dev` in backend/ finds backend/.env.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1d';
const EXAMPLE_JWT_SECRET = 'replace-with-a-long-random-secret';
const rawFrontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');

if (nodeEnv === 'production' && !databaseUrl) {
  throw new Error('DATABASE_URL is required in production');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

if (
  nodeEnv === 'production' &&
  (jwtSecret.length < 32 || jwtSecret === EXAMPLE_JWT_SECRET)
) {
  throw new Error('JWT_SECRET must be a unique value of at least 32 characters in production');
}

if (!jwtExpiresIn.trim()) {
  throw new Error('JWT_EXPIRES_IN is required');
}

// Production CORS and email action links must not silently fall back to localhost.
if (nodeEnv === 'production') {
  if (!process.env.FRONTEND_URL?.trim()) {
    throw new Error('FRONTEND_URL is required in production');
  }
  let frontendOrigin: URL;
  try {
    frontendOrigin = new URL(rawFrontendUrl);
  } catch {
    throw new Error('FRONTEND_URL must be a valid absolute URL in production');
  }
  if (!['http:', 'https:'].includes(frontendOrigin.protocol)) {
    throw new Error('FRONTEND_URL must use http or https in production');
  }
  if (frontendOrigin.hostname === 'localhost' || frontendOrigin.hostname === '127.0.0.1') {
    throw new Error('FRONTEND_URL must not point at localhost in production');
  }
}

const smtpPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);

export const env = {
  PORT: Number.parseInt(process.env.PORT ?? '4000', 10),
  NODE_ENV: nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  FRONTEND_URL: rawFrontendUrl,
  SERVICE_NAME: 'mini-erp-crm-api',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: jwtExpiresIn,
  EMAIL_FROM: process.env.EMAIL_FROM ?? '',
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: smtpPort,
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? '',
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  AUTH_VERIFY_TTL_MS: 24 * 60 * 60 * 1000,
  AUTH_RESET_TTL_MS: 60 * 60 * 1000,
} as const;

if (!Number.isFinite(env.PORT) || env.PORT <= 0) {
  throw new Error('PORT must be a positive number');
}

if (!Number.isFinite(env.SMTP_PORT) || env.SMTP_PORT <= 0) {
  throw new Error('SMTP_PORT must be a positive number');
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.EMAIL_FROM);
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID);
}
