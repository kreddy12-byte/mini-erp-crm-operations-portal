import { env } from '../config/env';

export function getHealthStatus() {
  return {
    service: env.SERVICE_NAME,
    environment: env.NODE_ENV,
  };
}
