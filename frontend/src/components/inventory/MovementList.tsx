import { EmptyState } from '../feedback/EmptyState.tsx';
import { MovementTypeBadge } from '../products/productDisplay.tsx';
import type { StockMovement } from '../../types/product.ts';
import { formatDateTime } from '../../utils/dates.ts';

export function MovementList({ movements }: { movements: StockMovement[] }) {
  if (movements.length === 0) {
    return (
      <EmptyState
        title="No movements yet"
        description="Stock in and stock out records will appear here. History cannot be edited."
      />
    );
  }

  return (
    <ol className="space-y-4">
      {movements.map((item) => (
        <li key={item.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MovementTypeBadge type={item.movementType} />
            <span className="text-caption">{formatDateTime(item.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-ink">
            {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
          </p>
          <p className="mt-1 text-secondary">{item.reason}</p>
          <p className="mt-1 text-caption">By {item.createdBy.name}</p>
        </li>
      ))}
    </ol>
  );
}
