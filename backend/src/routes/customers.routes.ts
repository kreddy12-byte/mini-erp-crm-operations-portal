import { UserRole } from '@prisma/client';
import { Router } from 'express';
import {
  create,
  createFollowUp,
  getById,
  list,
  listFollowUps,
  update,
} from '../controllers/customers.controller';
import { authenticate } from '../middleware/authenticate';
import { authorizeRoles } from '../middleware/authorize';
import { asyncHandler } from '../utils/async-handler';

export const customersRouter = Router();

const canManageCustomers = [UserRole.ADMIN, UserRole.SALES] as const;

customersRouter.use(authenticate, authorizeRoles(...canManageCustomers));

customersRouter.get('/', asyncHandler(list));
customersRouter.post('/', asyncHandler(create));
customersRouter.get('/:id/follow-ups', asyncHandler(listFollowUps));
customersRouter.post('/:id/follow-ups', asyncHandler(createFollowUp));
customersRouter.get('/:id', asyncHandler(getById));
customersRouter.patch('/:id', asyncHandler(update));
