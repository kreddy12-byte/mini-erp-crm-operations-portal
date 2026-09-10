import type { Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service';
import { sendSuccess } from '../utils/http';

export function getHealth(_req: Request, res: Response): void {
  // 1. LOAD DATA
  const data = getHealthStatus();

  // 2. RETURN RESPONSE
  sendSuccess(res, data, 'API is healthy');
}
