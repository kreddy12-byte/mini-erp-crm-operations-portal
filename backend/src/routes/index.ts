import { Router } from 'express';
import { authRouter } from './auth.routes';
import { customersRouter } from './customers.routes';
import { healthRouter } from './health.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/customers', customersRouter);
