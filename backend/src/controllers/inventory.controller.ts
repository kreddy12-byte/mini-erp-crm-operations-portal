import type { Request, Response } from 'express';
import { listInventory } from '../services/products.service';
import { listStockMovements, recordStockMovement } from '../services/inventory.service';
import { AppError, ErrorCodes } from '../utils/app-error';
import { sendSuccess } from '../utils/http';
import {
  parseMovementListQuery,
  parseProductId,
  parseProductListQuery,
  parseStockMovementBody,
} from '../validators/product.validator';

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseProductListQuery(req.query);
  const data = await listInventory(query);
  sendSuccess(res, data, 'Inventory loaded');
}

export async function listMovements(req: Request, res: Response): Promise<void> {
  const productId = parseProductId(req.params.productId);
  const query = parseMovementListQuery(req.query);
  const data = await listStockMovements(productId, query);
  sendSuccess(res, data, 'Movements loaded');
}

export async function createMovement(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }
  const productId = parseProductId(req.params.productId);
  const input = parseStockMovementBody(req.body);
  const data = await recordStockMovement(productId, input, req.auth.id);
  sendSuccess(res, data, 'Stock movement recorded', 201);
}
