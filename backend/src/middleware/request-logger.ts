import type { Request, Response, NextFunction } from 'express';

/**
 * Development-oriented access log.
 * Headers and bodies are never logged because they may later contain credentials.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
}
