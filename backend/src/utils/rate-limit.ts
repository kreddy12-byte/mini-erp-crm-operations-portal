import { AppError, ErrorCodes } from './app-error';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function assertWithinLimit(key: string, max: number, _windowMs: number, message: string): void {
  pruneExpired();
  const now = Date.now();
  const current = buckets.get(key);
  if (current && current.resetAt > now && current.count >= max) {
    throw new AppError(429, ErrorCodes.RATE_LIMITED, message);
  }
}

export function hitRateLimit(key: string, windowMs: number): void {
  pruneExpired();
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
