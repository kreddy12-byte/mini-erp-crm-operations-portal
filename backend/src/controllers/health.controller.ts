import type { Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service';
import { sendSuccess } from '../utils/http';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  // 1. LOAD DATA
  const data = await getHealthStatus();

  // 2. RETURN RESPONSE
  sendSuccess(res, data, 'API is healthy');
}
