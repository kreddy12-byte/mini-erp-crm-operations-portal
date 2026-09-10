import type { AuthTokenType, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import type { AuthenticatedUser } from '../types/auth';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

const sessionUserSelect = {
  ...publicUserSelect,
  passwordHash: true,
  emailVerifiedAt: true,
  googleId: true,
  tokenVersion: true,
} as const;

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: sessionUserSelect,
  });
}

export async function findUserByGoogleId(googleId: string) {
  return prisma.user.findUnique({
    where: { googleId },
    select: sessionUserSelect,
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: sessionUserSelect,
  });
}

export async function findPublicUserById(id: string): Promise<AuthenticatedUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash?: string | null;
  role: UserRole;
  emailVerifiedAt?: Date | null;
  googleId?: string | null;
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash ?? null,
      role: data.role,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
      googleId: data.googleId ?? null,
    },
    select: sessionUserSelect,
  });
}

export async function markEmailVerified(id: string) {
  return prisma.user.update({
    where: { id },
    data: { emailVerifiedAt: new Date() },
    select: sessionUserSelect,
  });
}

export async function updatePasswordAndInvalidateSessions(id: string, passwordHash: string) {
  return prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
    },
    select: sessionUserSelect,
  });
}

export async function linkGoogleId(id: string, googleId: string) {
  return prisma.user.update({
    where: { id },
    data: {
      googleId,
      emailVerifiedAt: new Date(),
    },
    select: sessionUserSelect,
  });
}

export async function createAuthToken(data: {
  userId: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
}) {
  return prisma.authToken.create({ data });
}

export async function invalidateUnusedTokens(userId: string, type: AuthTokenType) {
  return prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export async function findAuthTokenByHash(type: AuthTokenType, tokenHash: string) {
  return prisma.authToken.findFirst({
    where: { type, tokenHash },
    include: { user: { select: sessionUserSelect } },
  });
}

export async function markAuthTokenUsed(id: string) {
  return prisma.authToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}
