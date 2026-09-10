import dotenv from 'dotenv';
import path from 'node:path';

// Load from the process working directory so `npm run dev` in backend/ finds backend/.env.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1d';
const EXAMPLE_JWT_SECRET = 'replace-with-a-long-random-secret';

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

export const env = {
  PORT: Number.parseInt(process.env.PORT ?? '4000', 10),
  NODE_ENV: nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  SERVICE_NAME: 'mini-erp-crm-api',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: jwtExpiresIn,
} as const;

if (!Number.isFinite(env.PORT) || env.PORT <= 0) {
  throw new Error('PORT must be a positive number');
}
