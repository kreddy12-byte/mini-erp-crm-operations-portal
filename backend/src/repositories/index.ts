/**
 * Persistence adapters wrap Prisma. Import the shared client from config/database.
 * Do not construct PrismaClient inside repositories or request handlers.
 */
export { prisma } from '../config/database';
export { findPublicUserById, findUserByEmail, findUserById } from './users.repository';
export {
  createCustomer,
  createFollowUp,
  findCustomerById,
  listCustomers,
  listFollowUps,
  updateCustomer,
} from './customers.repository';
export {
  adjustStock,
  createProductWithOptionalOpening,
  findProductById,
  findProductBySku,
  inventorySummary,
  listCategories,
  listMovements,
  listProducts,
  listRecentMovements,
  updateProduct,
} from './products.repository';
