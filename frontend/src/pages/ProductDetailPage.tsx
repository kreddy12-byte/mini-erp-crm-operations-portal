import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { MovementHistoryModal } from '../components/inventory/MovementHistoryModal.tsx';
import { MovementList } from '../components/inventory/MovementList.tsx';
import { StockMovementModal } from '../components/inventory/StockMovementModal.tsx';
import { ProductFormModal } from '../components/products/ProductFormModal.tsx';
import { StockStatusBadge } from '../components/products/productDisplay.tsx';
import { Button } from '../components/ui/Button.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PageSkeleton } from '../components/ui/Skeleton.tsx';
import { canManageProducts, canMoveStock, formatUnitPrice } from '../constants/product.ts';
import { paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { createStockMovement } from '../services/inventory.ts';
import { getProduct, updateProduct } from '../services/products.ts';
import { ApiClientError } from '../types/api.ts';
import type { CreateProductRequest, CreateStockMovementRequest, Product, UpdateProductRequest } from '../types/product.ts';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [retryKey, setRetryKey] = useState(0);

  if (!id) {
    return (
      <div>
        <PageHeader title="Product" description="This record could not be opened." />
        <ErrorState title="Product not found" description="The product id is missing." />
      </div>
    );
  }

  return <ProductDetailRecord key={`${id}-${retryKey}`} id={id} onRetry={() => setRetryKey((value) => value + 1)} />;
}

function ProductDetailRecord({ id, onRetry }: { id: string; onRetry: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canManage = canManageProducts(user?.role);
  const canAdjust = canMoveStock(user?.role);

  useEffect(() => {
    let cancelled = false;

    getProduct(id)
      .then((record) => {
        if (cancelled) return;
        setProduct(record);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setNotFound(reason instanceof ApiClientError && reason.status === 404);
        setError(reason instanceof ApiClientError ? reason.message : 'Unable to load this product.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(payload: CreateProductRequest | UpdateProductRequest) {
    if (!product) return;
    const updated = await updateProduct(product.id, {
      name: payload.name,
      sku: payload.sku,
      category: payload.category,
      unitPrice: payload.unitPrice,
      minStock: payload.minStock,
      location: payload.location,
    });
    setProduct({ ...product, ...updated });
    setEditOpen(false);
    pushToast({ title: 'Product updated', tone: 'success' });
  }

  async function handleMovement(payload: CreateStockMovementRequest) {
    if (!product) return;
    await createStockMovement(product.id, payload);
    const refreshed = await getProduct(product.id);
    setProduct(refreshed);
    setAdjustOpen(false);
    pushToast({
      title: payload.movementType === 'IN' ? 'Stock received' : 'Stock issued',
      tone: 'success',
    });
  }

  if (status === 'loading') {
    return (
      <div>
        <PageHeader title="Product" description="Loading record." />
        <PageSkeleton />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div>
        <PageHeader title="Product" description="This record could not be opened." />
        <p className="mb-4">
          <Link to={paths.products} className="text-sm font-medium text-primary hover:text-primary-hover">
            Back to products
          </Link>
        </p>
        <ErrorState
          title={notFound ? 'Product not found' : 'Unable to load product'}
          description={error ?? 'This product could not be loaded.'}
          onRetry={notFound ? undefined : onRetry}
        />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title={product.name}
        description={product.sku}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(paths.products)}>
              Back to list
            </Button>
            {canManage ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            ) : null}
            {canAdjust ? <Button onClick={() => setAdjustOpen(true)}>Adjust stock</Button> : null}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StockStatusBadge status={product.stockStatus} />
        <span className="text-secondary">{product.category}</span>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="text-section">Catalog</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="SKU" value={product.sku} />
              <Info label="Category" value={product.category} />
              <Info label="Unit price" value={formatUnitPrice(product.unitPrice)} />
              <Info label="Location" value={product.location} />
            </dl>
          </section>

          <section>
            <h2 className="text-section">Stock</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="Current stock" value={String(product.currentStock)} />
              <Info label="Minimum stock alert" value={String(product.minStock)} />
            </dl>
          </section>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-section">Recent movements</h2>
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
              Full history
            </Button>
          </div>
          {product.recentMovements && product.recentMovements.length > 0 ? (
            <MovementList movements={product.recentMovements} />
          ) : (
            <EmptyState
              title="No movements yet"
              description="Opening stock and later IN/OUT adjustments will appear here."
            />
          )}
        </section>
      </div>

      {editOpen ? (
        <ProductFormModal
          open
          product={product}
          onClose={() => setEditOpen(false)}
          onSubmit={handleSave}
        />
      ) : null}
      {adjustOpen ? (
        <StockMovementModal
          open
          product={product}
          onClose={() => setAdjustOpen(false)}
          onSubmit={handleMovement}
        />
      ) : null}
      {historyOpen ? (
        <MovementHistoryModal open product={product} onClose={() => setHistoryOpen(false)} />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption">{label}</dt>
      <dd className="mt-1 text-body">{value}</dd>
    </div>
  );
}
