import type { StockStatus } from '../types/product';

// CRITICAL is currentStock = 0, even if minStock is also 0.
export function resolveStockStatus(currentStock: number, minStock: number): StockStatus {
  if (currentStock <= 0) {
    return 'CRITICAL';
  }
  if (currentStock <= minStock) {
    return 'LOW';
  }
  return 'HEALTHY';
}
