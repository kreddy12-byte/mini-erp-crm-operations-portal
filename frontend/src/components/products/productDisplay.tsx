import { Badge } from '../ui/Badge.tsx';
import { MOVEMENT_TYPE_LABELS, STOCK_STATUS_LABELS } from '../../constants/product.ts';
import type { MovementType, ProductStockStatus } from '../../types/product.ts';

export function StockStatusBadge({ status }: { status: ProductStockStatus }) {
  const tone = status === 'HEALTHY' ? 'success' : status === 'LOW' ? 'warning' : 'danger';
  return <Badge tone={tone}>{STOCK_STATUS_LABELS[status]}</Badge>;
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  return <Badge tone={type === 'IN' ? 'info' : 'warning'}>{MOVEMENT_TYPE_LABELS[type]}</Badge>;
}
