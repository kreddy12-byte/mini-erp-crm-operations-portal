import { prisma } from '../config/database';
import type { AuthenticatedUser } from '../types/auth';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function findPublicUserById(id: string): Promise<AuthenticatedUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
}
