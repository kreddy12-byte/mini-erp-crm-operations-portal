import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { cancel, confirm, create, getById, list, update } from '../controllers/challans.controller';
import { authenticate } from '../middleware/authenticate';
import { authorizeRoles } from '../middleware/authorize';
import { asyncHandler } from '../utils/async-handler';

export const challansRouter = Router();

const canViewChallans = [UserRole.ADMIN, UserRole.SALES, UserRole.WAREHOUSE, UserRole.ACCOUNTS] as const;
const canManageChallans = [UserRole.ADMIN, UserRole.SALES] as const;

challansRouter.use(authenticate);

challansRouter.get('/', authorizeRoles(...canViewChallans), asyncHandler(list));
challansRouter.post('/', authorizeRoles(...canManageChallans), asyncHandler(create));
challansRouter.get('/:id', authorizeRoles(...canViewChallans), asyncHandler(getById));
challansRouter.patch('/:id', authorizeRoles(...canManageChallans), asyncHandler(update));
challansRouter.post('/:id/confirm', authorizeRoles(...canManageChallans), asyncHandler(confirm));
challansRouter.post('/:id/cancel', authorizeRoles(...canManageChallans), asyncHandler(cancel));
