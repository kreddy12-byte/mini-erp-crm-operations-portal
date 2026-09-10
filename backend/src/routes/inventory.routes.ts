import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { createMovement, list, listMovements } from '../controllers/inventory.controller';
import { authenticate } from '../middleware/authenticate';
import { authorizeRoles } from '../middleware/authorize';
import { asyncHandler } from '../utils/async-handler';

export const inventoryRouter = Router();

const canViewInventory = [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.SALES, UserRole.ACCOUNTS] as const;
const canMoveStock = [UserRole.ADMIN, UserRole.WAREHOUSE] as const;

inventoryRouter.use(authenticate);

inventoryRouter.get('/', authorizeRoles(...canViewInventory), asyncHandler(list));
inventoryRouter.get('/:productId/movements', authorizeRoles(...canViewInventory), asyncHandler(listMovements));
inventoryRouter.post('/:productId/movements', authorizeRoles(...canMoveStock), asyncHandler(createMovement));
