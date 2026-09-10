import bcrypt from 'bcrypt';

// Cost 10 is strong enough for this case study without slowing local seed/login.
const BCRYPT_COST = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    // Malformed hashes must not leak as 500s or confirm that an account exists.
    return false;
  }
}
