import type { ProductStockStatus } from '../types/product.ts';

// Mirrors backend/src/services/stock-status.ts for local previews only.
// List/detail badges should prefer the API's stockStatus field.
export function resolveStockStatus(currentStock: number, minStock: number): ProductStockStatus {
  if (currentStock <= 0) {
    return 'CRITICAL';
  }
  if (currentStock <= minStock) {
    return 'LOW';
  }
  return 'HEALTHY';
}
