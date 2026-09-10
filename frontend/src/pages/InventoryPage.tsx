import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { MovementHistoryModal } from '../components/inventory/MovementHistoryModal.tsx';
import { StockMovementModal } from '../components/inventory/StockMovementModal.tsx';
import { StockStatusBadge } from '../components/products/productDisplay.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { canMoveStock } from '../constants/product.ts';
import { productPath } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { createStockMovement, listInventory } from '../services/inventory.ts';
import { ApiClientError } from '../types/api.ts';
import type {
  CreateStockMovementRequest,
  InventorySummary,
  PaginationMeta,
  Product,
  ProductStockStatus,
} from '../types/product.ts';

function readParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? '';
}

const EMPTY_SUMMARY: InventorySummary = { total: 0, healthy: 0, low: 0, critical: 0 };

export function InventoryPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(readParam(searchParams, 'search'));
  const [locationInput, setLocationInput] = useState(readParam(searchParams, 'location'));
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<InventorySummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const canAdjust = canMoveStock(user?.role);

  const filters = useMemo(
    () => ({
      search: readParam(searchParams, 'search'),
      category: readParam(searchParams, 'category'),
      stockStatus: readParam(searchParams, 'stockStatus') as ProductStockStatus | '',
      location: readParam(searchParams, 'location'),
      page: Number.parseInt(readParam(searchParams, 'page') || '1', 10) || 1,
    }),
    [searchParams],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      let changed = false;
      if (searchInput !== filters.search) {
        if (searchInput.trim()) next.set('search', searchInput.trim());
        else next.delete('search');
        changed = true;
      }
      if (locationInput !== filters.location) {
        if (locationInput.trim()) next.set('location', locationInput.trim());
        else next.delete('location');
        changed = true;
      }
      if (!changed) return;
      next.delete('page');
      setSearchParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput, locationInput, filters.search, filters.location, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    listInventory({
      page: filters.page,
      pageSize: 20,
      search: filters.search || undefined,
      category: filters.category || undefined,
      stockStatus: filters.stockStatus || undefined,
      location: filters.location || undefined,
      sortBy: 'currentStock',
      sortOrder: 'asc',
    })
      .then((result) => {
        if (cancelled) return;
        setProducts(result.products);
        setCategories(result.categories);
        setSummary(result.summary);
        setPagination(result.pagination);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof ApiClientError ? reason.message : 'Unable to load inventory.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [filters, reloadToken]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) next.delete('page');
    else next.set('page', String(page));
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchInput('');
    setLocationInput('');
    setSearchParams(new URLSearchParams());
  }

  async function handleMovement(payload: CreateStockMovementRequest) {
    if (!adjusting) return;
    const result = await createStockMovement(adjusting.id, payload);
    setProducts((current) => current.map((item) => (item.id === result.product.id ? result.product : item)));
    setAdjusting(null);
    setReloadToken((value) => value + 1);
    pushToast({
      title: payload.movementType === 'IN' ? 'Stock received' : 'Stock issued',
      tone: 'success',
    });
  }

  const hasFilters = Boolean(filters.search || filters.category || filters.stockStatus || filters.location);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="On-hand quantities, low-stock alerts, and stock movements."
      />

      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 border-b border-line pb-4 sm:grid-cols-4">
        <SummaryStat label="Total products" value={summary.total} />
        <SummaryStat label="Healthy" value={summary.healthy} />
        <SummaryStat label="Low stock" value={summary.low} />
        <SummaryStat label="Out of stock" value={summary.critical} />
      </dl>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Input
          label="Search"
          name="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Name, SKU, or category"
        />
        <Select
          label="Category"
          name="category"
          value={filters.category}
          onChange={(event) => updateFilter('category', event.target.value)}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((category) => ({ value: category, label: category })),
          ]}
        />
        <Select
          label="Stock status"
          name="stockStatus"
          value={filters.stockStatus}
          onChange={(event) => updateFilter('stockStatus', event.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'HEALTHY', label: 'Healthy' },
            { value: 'LOW', label: 'Low stock' },
            { value: 'CRITICAL', label: 'Out of stock' },
          ]}
        />
        <Input
          label="Location"
          name="location"
          value={locationInput}
          onChange={(event) => setLocationInput(event.target.value)}
          placeholder="Any location"
        />
      </div>

      {status === 'loading' ? (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
          <span className="sr-only">Loading inventory</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : null}

      {status === 'error' ? (
        <ErrorState
          title="Unable to load inventory"
          description={error ?? 'The inventory list did not load.'}
          onRetry={() => setReloadToken((value) => value + 1)}
        />
      ) : null}

      {status === 'success' && products.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No matching stock positions' : 'No inventory yet'}
          description={
            hasFilters
              ? 'Nothing matches the current search or filters.'
              : 'Products will appear here once they are added to the catalog.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : null
          }
        />
      ) : null}

      {status === 'success' && products.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-caption">
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Location</th>
                  <th className="py-2 pr-4 font-medium">Current</th>
                  <th className="py-2 pr-4 font-medium">Minimum</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-line last:border-b-0">
                    <td className="py-3 pr-4">
                      <Link to={productPath(product.id)} className="font-medium text-ink hover:text-primary">
                        {product.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-secondary">{product.sku}</td>
                    <td className="py-3 pr-4 text-secondary">{product.category}</td>
                    <td className="py-3 pr-4 text-secondary">{product.location}</td>
                    <td className="py-3 pr-4 font-medium text-ink">{product.currentStock}</td>
                    <td className="py-3 pr-4 text-secondary">{product.minStock}</td>
                    <td className="py-3 pr-4">
                      <StockStatusBadge status={product.stockStatus} />
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-3">
                        {canAdjust ? (
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:text-primary-hover"
                            onClick={() => setAdjusting(product)}
                          >
                            Adjust
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-sm font-medium text-ink-secondary hover:text-ink"
                          onClick={() => setHistoryFor(product)}
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {products.map((product) => (
              <li key={product.id} className="border-b border-line pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={productPath(product.id)} className="font-medium text-ink hover:text-primary">
                      {product.name}
                    </Link>
                    <p className="text-secondary">
                      {product.sku} · {product.location}
                    </p>
                    <p className="mt-1 text-caption">
                      {product.currentStock} on hand · min {product.minStock}
                    </p>
                  </div>
                  <StockStatusBadge status={product.stockStatus} />
                </div>
                <div className="mt-2 flex gap-3">
                  {canAdjust ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-primary hover:text-primary-hover"
                      onClick={() => setAdjusting(product)}
                    >
                      Adjust stock
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-sm font-medium text-ink-secondary hover:text-ink"
                    onClick={() => setHistoryFor(product)}
                  >
                    History
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {pagination ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-caption">
                {pagination.total} products · page {pagination.page}
                {pagination.totalPages ? ` of ${pagination.totalPages}` : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={!pagination.hasPrevious} onClick={() => setPage(pagination.page - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={!pagination.hasNext} onClick={() => setPage(pagination.page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {adjusting ? (
        <StockMovementModal
          open
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSubmit={handleMovement}
        />
      ) : null}
      {historyFor ? (
        <MovementHistoryModal open product={historyFor} onClose={() => setHistoryFor(null)} />
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-caption">{label}</dt>
      <dd className="mt-1 text-section">{value}</dd>
    </div>
  );
}
