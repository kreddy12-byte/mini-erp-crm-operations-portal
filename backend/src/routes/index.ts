import { Router } from 'express';
import { authRouter } from './auth.routes';
import { challansRouter } from './challans.routes';
import { customersRouter } from './customers.routes';
import { healthRouter } from './health.routes';
import { inventoryRouter } from './inventory.routes';
import { productsRouter } from './products.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/challans', challansRouter);
