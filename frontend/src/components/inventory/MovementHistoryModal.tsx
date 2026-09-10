import { useEffect, useState } from 'react';
import { ErrorState } from '../feedback/ErrorState.tsx';
import { Button } from '../ui/Button.tsx';
import { Modal } from '../ui/Modal.tsx';
import { Select } from '../ui/Select.tsx';
import { Skeleton } from '../ui/Skeleton.tsx';
import { MovementList } from './MovementList.tsx';
import { listStockMovements } from '../../services/inventory.ts';
import { ApiClientError } from '../../types/api.ts';
import type { MovementType, PaginationMeta, Product, StockMovement } from '../../types/product.ts';

interface MovementHistoryModalProps {
  open: boolean;
  product: Product;
  onClose: () => void;
}

export function MovementHistoryModal({ open, product, onClose }: MovementHistoryModalProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    listStockMovements(product.id, {
      page,
      pageSize: 10,
      movementType: movementType || undefined,
      sortOrder: 'desc',
    })
      .then((result) => {
        if (cancelled) return;
        setMovements(result.movements);
        setPagination(result.pagination);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof ApiClientError ? reason.message : 'Unable to load movement history.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [product.id, page, movementType, reloadToken]);

  return (
    <Modal
      open={open}
      title="Movement history"
      description={`${product.name} · ${product.sku}`}
      onClose={onClose}
      className="w-[min(36rem,calc(100vw-2rem))]"
    >
      <div className="mb-4">
        <Select
          label="Movement type"
          name="historyMovementType"
          value={movementType}
          onChange={(event) => {
            setMovementType(event.target.value as MovementType | '');
            setPage(1);
            setStatus('loading');
          }}
          options={[
            { value: '', label: 'All movements' },
            { value: 'IN', label: 'Stock in' },
            { value: 'OUT', label: 'Stock out' },
          ]}
        />
      </div>

      {status === 'loading' ? (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
          <span className="sr-only">Loading movement history</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}

      {status === 'error' ? (
        <ErrorState
          title="Unable to load history"
          description={error ?? 'Movement history did not load.'}
          onRetry={() => {
            setStatus('loading');
            setReloadToken((value) => value + 1);
          }}
        />
      ) : null}

      {status === 'success' ? <MovementList movements={movements} /> : null}

      {status === 'success' && pagination ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption">
            {pagination.total} records · page {pagination.page}
            {pagination.totalPages ? ` of ${pagination.totalPages}` : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPrevious}
              onClick={() => {
                setStatus('loading');
                setPage(pagination.page - 1);
              }}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => {
                setStatus('loading');
                setPage(pagination.page + 1);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
