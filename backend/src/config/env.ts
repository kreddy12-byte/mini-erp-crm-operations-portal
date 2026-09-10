import dotenv from 'dotenv';
import path from 'node:path';

// Load from the process working directory so `npm run dev` in backend/ finds backend/.env.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const databaseUrl = process.env.DATABASE_URL ?? '';

if (nodeEnv === 'production' && !databaseUrl) {
  throw new Error('DATABASE_URL is required in production');
}

export const env = {
  PORT: Number.parseInt(process.env.PORT ?? '4000', 10),
  NODE_ENV: nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  SERVICE_NAME: 'mini-erp-crm-api',
  DATABASE_URL: databaseUrl,
} as const;

if (!Number.isFinite(env.PORT) || env.PORT <= 0) {
  throw new Error('PORT must be a positive number');
}
