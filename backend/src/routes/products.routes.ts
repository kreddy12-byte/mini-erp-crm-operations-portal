import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { create, getById, list, update } from '../controllers/products.controller';
import { authenticate } from '../middleware/authenticate';
import { authorizeRoles } from '../middleware/authorize';
import { asyncHandler } from '../utils/async-handler';

export const productsRouter = Router();

const canViewProducts = [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.SALES, UserRole.ACCOUNTS] as const;
const canManageProducts = [UserRole.ADMIN, UserRole.WAREHOUSE] as const;

productsRouter.use(authenticate);

productsRouter.get('/', authorizeRoles(...canViewProducts), asyncHandler(list));
productsRouter.post('/', authorizeRoles(...canManageProducts), asyncHandler(create));
productsRouter.get('/:id', authorizeRoles(...canViewProducts), asyncHandler(getById));
productsRouter.patch('/:id', authorizeRoles(...canManageProducts), asyncHandler(update));
