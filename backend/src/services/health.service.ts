import { pingDatabase } from '../config/database';
import { env } from '../config/env';

export async function getHealthStatus() {
  return {
    service: env.SERVICE_NAME,
    environment: env.NODE_ENV,
    database: await pingDatabase(),
  };
}
