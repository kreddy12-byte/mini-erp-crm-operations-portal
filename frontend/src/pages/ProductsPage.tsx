import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { ProductFormModal } from '../components/products/ProductFormModal.tsx';
import { StockStatusBadge } from '../components/products/productDisplay.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Dropdown } from '../components/ui/Dropdown.tsx';
import { Input } from '../components/ui/Input.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { canManageProducts, formatUnitPrice } from '../constants/product.ts';
import { productPath } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { createProduct, listProducts, updateProduct } from '../services/products.ts';
import { ApiClientError } from '../types/api.ts';
import type {
  CreateProductRequest,
  PaginationMeta,
  Product,
  ProductStockStatus,
  UpdateProductRequest,
} from '../types/product.ts';

function readParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? '';
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(readParam(searchParams, 'search'));
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const canManage = canManageProducts(user?.role);

  const filters = useMemo(
    () => ({
      search: readParam(searchParams, 'search'),
      category: readParam(searchParams, 'category'),
      stockStatus: readParam(searchParams, 'stockStatus') as ProductStockStatus | '',
      page: Number.parseInt(readParam(searchParams, 'page') || '1', 10) || 1,
    }),
    [searchParams],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput === filters.search) return;
      const next = new URLSearchParams(searchParams);
      if (searchInput.trim()) next.set('search', searchInput.trim());
      else next.delete('search');
      next.delete('page');
      setSearchParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput, filters.search, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    listProducts({
      page: filters.page,
      pageSize: 20,
      search: filters.search || undefined,
      category: filters.category || undefined,
      stockStatus: filters.stockStatus || undefined,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })
      .then((result) => {
        if (cancelled) return;
        setProducts(result.products);
        setCategories(result.categories);
        setPagination(result.pagination);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof ApiClientError ? reason.message : 'Unable to load products.');
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
    setSearchParams(new URLSearchParams());
  }

  async function handleSave(payload: CreateProductRequest | UpdateProductRequest) {
    if (editing) {
      await updateProduct(editing.id, payload);
      pushToast({ title: 'Product updated', tone: 'success' });
    } else {
      await createProduct(payload as CreateProductRequest);
      pushToast({ title: 'Product added', tone: 'success' });
    }
    setFormOpen(false);
    setEditing(null);
    setReloadToken((value) => value + 1);
  }

  const hasFilters = Boolean(filters.search || filters.category || filters.stockStatus);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Catalog, pricing, and current stock for warehouse and sales."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add product
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
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
      </div>

      {status === 'loading' ? <ProductListSkeleton /> : null}

      {status === 'error' ? (
        <ErrorState
          title="Unable to load products"
          description={error ?? 'The product list did not load.'}
          onRetry={() => setReloadToken((value) => value + 1)}
        />
      ) : null}

      {status === 'success' && products.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No matching products' : 'No products yet'}
          description={
            hasFilters
              ? 'Nothing matches the current search or filters.'
              : 'Add a product to start the catalog and inventory records.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : canManage ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add product
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
                  <th className="py-2 pr-4 font-medium">Price</th>
                  <th className="py-2 pr-4 font-medium">Stock</th>
                  <th className="py-2 pr-4 font-medium">Location</th>
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
                    <td className="py-3 pr-4 text-secondary">{formatUnitPrice(product.unitPrice)}</td>
                    <td className="py-3 pr-4 text-ink">{product.currentStock}</td>
                    <td className="py-3 pr-4 text-secondary">{product.location}</td>
                    <td className="py-3 pr-4">
                      <StockStatusBadge status={product.stockStatus} />
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        <Dropdown
                          label={`Actions for ${product.name}`}
                          trigger={
                            <span className="text-sm font-medium text-primary hover:text-primary-hover">Actions</span>
                          }
                          items={[
                            { id: 'view', label: 'View', onSelect: () => navigate(productPath(product.id)) },
                            ...(canManage
                              ? [
                                  {
                                    id: 'edit',
                                    label: 'Edit',
                                    onSelect: () => {
                                      setEditing(product);
                                      setFormOpen(true);
                                    },
                                  },
                                ]
                              : []),
                          ]}
                        />
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
                      {product.sku} · {product.category}
                    </p>
                    <p className="mt-1 text-caption">
                      {formatUnitPrice(product.unitPrice)} · {product.currentStock} in {product.location}
                    </p>
                  </div>
                  <StockStatusBadge status={product.stockStatus} />
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-ink-secondary hover:text-ink"
                    onClick={() => {
                      setEditing(product);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
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

      {formOpen ? (
        <ProductFormModal
          open
          product={editing}
          categories={categories}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSave}
        />
      ) : null}
    </div>
  );
}

function ProductListSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
      <span className="sr-only">Loading products</span>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  );
}
