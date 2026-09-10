import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(leftHash: string, rightHash: string): boolean {
  const left = Buffer.from(leftHash);
  const right = Buffer.from(rightHash);
  return left.length === right.length && timingSafeEqual(left, right);
}
