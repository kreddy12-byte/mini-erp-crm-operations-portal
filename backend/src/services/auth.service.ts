import { AuthTokenType, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import {
  createAuthToken,
  createUser,
  findAuthTokenByHash,
  findUserByEmail,
  findUserByGoogleId,
  invalidateUnusedTokens,
  linkGoogleId,
  markAuthTokenUsed,
  markEmailVerified,
  updatePasswordAndInvalidateSessions,
} from '../repositories/users.repository';
import type { AuthenticatedUser, LoginResult, SignupResult } from '../types/auth';
import { AppError, ErrorCodes } from '../utils/app-error';
import { signAccessToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { assertWithinLimit, hitRateLimit, resetRateLimit } from '../utils/rate-limit';
import { generateOpaqueToken, hashOpaqueToken } from '../utils/secure-token';
import { passwordResetEmail, verificationEmail } from './email-templates';
import { assertEmailDeliveryConfigured, sendEmail } from './email.service';
import { verifyGoogleIdToken } from './google-identity.service';

const INVALID_CREDENTIALS = new AppError(
  401,
  ErrorCodes.INVALID_CREDENTIALS,
  'Invalid email or password.',
);

const INVALID_TOKEN = new AppError(
  400,
  ErrorCodes.INVALID_TOKEN,
  'This link is invalid or has expired.',
);

const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, a reset link has been sent.';

const GENERIC_VERIFY_MESSAGE =
  'If an unverified account exists for that email, a new verification link has been sent.';

const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_ACTION_WINDOW_MS = 15 * 60 * 1000;

let dummyPasswordHash: string | undefined;

async function getDummyPasswordHash(): Promise<string> {
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

function issueSession(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
}): LoginResult {
  return {
    token: signAccessToken(user.id, user.role, user.tokenVersion),
    user: toPublicUser(user),
  };
}

function duplicateEmailError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function issueAndEmailToken(params: {
  userId: string;
  email: string;
  name: string;
  type: AuthTokenType;
  ttlMs: number;
  path: '/verify-email' | '/reset-password';
}): Promise<void> {
  assertEmailDeliveryConfigured();
  await invalidateUnusedTokens(params.userId, params.type);

  const rawToken = generateOpaqueToken();
  await createAuthToken({
    userId: params.userId,
    type: params.type,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAt: new Date(Date.now() + params.ttlMs),
  });

  const actionUrl = `${env.FRONTEND_URL}${params.path}?token=${encodeURIComponent(rawToken)}`;
  const template =
    params.type === AuthTokenType.EMAIL_VERIFICATION
      ? verificationEmail({ name: params.name, actionUrl })
      : passwordResetEmail({ name: params.name, actionUrl });

  await sendEmail({
    to: params.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  // 1. RATE-LIMIT FAILED ATTEMPTS for this email without revealing whether it exists.
  assertWithinLimit(
    `login-fail:${email}`,
    8,
    FAILED_LOGIN_WINDOW_MS,
    'Too many sign-in attempts. Try again in a few minutes.',
  );

  // 2. FIND USER
  const user = await findUserByEmail(email);

  // 3. VERIFY PASSWORD (dummy hash when missing so timing stays similar)
  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(password, passwordHash);

  if (!user || !passwordMatches) {
    hitRateLimit(`login-fail:${email}`, FAILED_LOGIN_WINDOW_MS);
    throw INVALID_CREDENTIALS;
  }

  // Email verification is optional; password login does not require emailVerifiedAt.
  resetRateLimit(`login-fail:${email}`);

  // 4. CREATE JWT
  return issueSession(user);
}

export async function signupUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SignupResult> {
  // 1. VALIDATE UNIQUENESS AND FORCE THE DEFAULT ERP ROLE.
  assertWithinLimit(
    `signup:${input.email}`,
    5,
    EMAIL_ACTION_WINDOW_MS,
    'Too many signup attempts. Try again in a few minutes.',
  );
  hitRateLimit(`signup:${input.email}`, EMAIL_ACTION_WINDOW_MS);

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AppError(409, ErrorCodes.DUPLICATE_EMAIL, 'An account with this email already exists.');
  }

  // Public self-registration is always SALES. Role is never taken from the request.
  // SMTP / email verification is optional and must not block account creation.
  try {
    const user = await createUser({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: UserRole.SALES,
    });

    return issueSession(user);
  } catch (error) {
    if (duplicateEmailError(error)) {
      throw new AppError(409, ErrorCodes.DUPLICATE_EMAIL, 'An account with this email already exists.');
    }
    throw error;
  }
}

export async function verifyEmail(token: string): Promise<LoginResult> {
  const tokenHash = hashOpaqueToken(token);
  const record = await findAuthTokenByHash(AuthTokenType.EMAIL_VERIFICATION, tokenHash);
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw INVALID_TOKEN;
  }

  await markAuthTokenUsed(record.id);
  await invalidateUnusedTokens(record.userId, AuthTokenType.EMAIL_VERIFICATION);

  const user = record.user.emailVerifiedAt
    ? record.user
    : await markEmailVerified(record.userId);

  return issueSession(user);
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  assertEmailDeliveryConfigured();
  assertWithinLimit(
    `resend:${email}`,
    5,
    EMAIL_ACTION_WINDOW_MS,
    'Too many verification emails requested. Try again in a few minutes.',
  );
  hitRateLimit(`resend:${email}`, EMAIL_ACTION_WINDOW_MS);

  const user = await findUserByEmail(email);
  if (user && !user.emailVerifiedAt) {
    await issueAndEmailToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      type: AuthTokenType.EMAIL_VERIFICATION,
      ttlMs: env.AUTH_VERIFY_TTL_MS,
      path: '/verify-email',
    });
  }

  return { message: GENERIC_VERIFY_MESSAGE };
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  assertEmailDeliveryConfigured();
  assertWithinLimit(
    `forgot:${email}`,
    5,
    EMAIL_ACTION_WINDOW_MS,
    'Too many reset requests. Try again in a few minutes.',
  );
  hitRateLimit(`forgot:${email}`, EMAIL_ACTION_WINDOW_MS);

  const user = await findUserByEmail(email);
  if (user) {
    await issueAndEmailToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      type: AuthTokenType.PASSWORD_RESET,
      ttlMs: env.AUTH_RESET_TTL_MS,
      path: '/reset-password',
    });
  }

  return { message: GENERIC_RESET_MESSAGE };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = hashOpaqueToken(token);
  const record = await findAuthTokenByHash(AuthTokenType.PASSWORD_RESET, tokenHash);
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw INVALID_TOKEN;
  }

  await markAuthTokenUsed(record.id);
  await invalidateUnusedTokens(record.userId, AuthTokenType.PASSWORD_RESET);
  await updatePasswordAndInvalidateSessions(record.userId, await hashPassword(password));
}

export async function signInWithGoogle(idToken: string): Promise<LoginResult> {
  // 1. VERIFY THE TOKEN WITH GOOGLE — never trust a client-supplied email.
  const identity = await verifyGoogleIdToken(idToken);

  // 2. LOAD OR CREATE THE ACCOUNT
  const byGoogle = await findUserByGoogleId(identity.googleId);
  if (byGoogle) {
    return issueSession(byGoogle);
  }

  const byEmail = await findUserByEmail(identity.email);
  if (byEmail) {
    const linked = await linkGoogleId(byEmail.id, identity.googleId);
    return issueSession(linked);
  }

  try {
    const created = await createUser({
      name: identity.name,
      email: identity.email,
      passwordHash: null,
      role: UserRole.SALES,
      emailVerifiedAt: new Date(),
      googleId: identity.googleId,
    });
    return issueSession(created);
  } catch (error) {
    if (duplicateEmailError(error)) {
      const existing = await findUserByEmail(identity.email);
      if (existing) {
        const linked = await linkGoogleId(existing.id, identity.googleId);
        return issueSession(linked);
      }
    }
    throw error;
  }
}

export { toPublicUser, GENERIC_RESET_MESSAGE, GENERIC_VERIFY_MESSAGE };
