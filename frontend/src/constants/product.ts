import type { UserRole } from '../types/auth.ts';
import type { MovementType, ProductStockStatus } from '../types/product.ts';

export const STOCK_STATUS_LABELS: Record<ProductStockStatus, string> = {
  HEALTHY: 'Healthy',
  LOW: 'Low stock',
  CRITICAL: 'Out of stock',
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
};

export function canManageProducts(role?: UserRole): boolean {
  return role === 'ADMIN' || role === 'WAREHOUSE';
}

export function canMoveStock(role?: UserRole): boolean {
  return role === 'ADMIN' || role === 'WAREHOUSE';
}

export function formatUnitPrice(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}
