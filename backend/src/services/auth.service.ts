import { findUserByEmail } from '../repositories/users.repository';
import type { AuthenticatedUser, LoginResult } from '../types/auth';
import { AppError, ErrorCodes } from '../utils/app-error';
import { signAccessToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

const INVALID_CREDENTIALS = new AppError(
  401,
  ErrorCodes.INVALID_CREDENTIALS,
  'Invalid email or password.',
);

let dummyPasswordHash: string | undefined;

async function getDummyPasswordHash(): Promise<string> {
  // Compare against a real bcrypt hash even when the email is unknown so timing
  // does not reveal whether an account exists.
  dummyPasswordHash ??= await hashPassword('timing-protection-unused');
  return dummyPasswordHash;
}

function toPublicUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  // 1. FIND USER
  const user = await findUserByEmail(email);

  // 2. VERIFY PASSWORD
  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(password, passwordHash);

  if (!user || !passwordMatches) {
    throw INVALID_CREDENTIALS;
  }

  // 3. CREATE JWT
  const token = signAccessToken(user.id, user.role);

  // 4. RETURN SAFE USER DATA
  return {
    token,
    user: toPublicUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }),
  };
}
