import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment ? ['error', 'warn'] : ['error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<'connected' | 'disconnected'> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch (error) {
    if (env.isDevelopment) {
      console.warn('PostgreSQL is not reachable. API will start without persistence.');
    } else {
      console.error('PostgreSQL connection failed.');
      console.error(error);
    }
    return 'disconnected';
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export async function pingDatabase(): Promise<'connected' | 'disconnected'> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch {
    return 'disconnected';
  }
}
