/**
 * Persistence adapters wrap Prisma. Import the shared client from config/database.
 * Do not construct PrismaClient inside repositories or request handlers.
 */
export { prisma } from '../config/database';
export { findPublicUserById, findUserByEmail } from './users.repository';
