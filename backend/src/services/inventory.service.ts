import { AppError, ErrorCodes } from '../utils/app-error';
import { toPaginationMeta } from '../utils/pagination';
import type { MovementListQuery, StockMovementInput } from '../types/product';
import {
  adjustStock,
  findProductById,
  listMovements as queryMovements,
} from '../repositories/products.repository';
import { toProduct } from './products.service';

export async function recordStockMovement(
  productId: string,
  input: StockMovementInput,
  createdById: string,
) {
  // 1. VALIDATE PRODUCT EXISTS (cheap check before locking)
  const existing = await findProductById(productId);
  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
  }

  // 2-5. LOCK ROW, VALIDATE STOCK RULES, UPDATE STOCK + RECORD MOVEMENT
  const result = await adjustStock({
    productId,
    movementType: input.movementType,
    quantity: input.quantity,
    reason: input.reason,
    createdById,
  });

  return {
    product: toProduct(result.product),
    previousStock: result.previousStock,
    quantity: input.quantity,
    movementType: input.movementType,
    newStock: result.nextStock,
    movement: {
      id: result.movement.id,
      productId: result.movement.productId,
      quantity: result.movement.quantity,
      movementType: result.movement.movementType,
      reason: result.movement.reason,
      createdAt: result.movement.createdAt,
      createdBy: result.movement.createdBy,
    },
  };
}

export async function listStockMovements(productId: string, query: MovementListQuery) {
  const existing = await findProductById(productId);
  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
  }

  const { total, rows } = await queryMovements(productId, query);
  return {
    product: toProduct(existing),
    movements: rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      quantity: row.quantity,
      movementType: row.movementType,
      reason: row.reason,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    })),
    pagination: toPaginationMeta(query.page, query.pageSize, total),
  };
}
