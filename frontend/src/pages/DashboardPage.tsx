import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChallanStatusBadge } from '../components/challans/ChallanStatusBadge.tsx';
import { FollowUpDate } from '../components/customers/customerDisplay.tsx';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { StockStatusBadge } from '../components/products/productDisplay.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { KpiStat } from '../components/ui/KpiStat.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PageSkeleton } from '../components/ui/Skeleton.tsx';
import { canManageChallans } from '../constants/challan.ts';
import { challanNewPath, challanPath, customerPath, paths, productPath } from '../constants/navigation.ts';
import { canManageProducts } from '../constants/product.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useHealth } from '../hooks/useHealth.ts';
import { listChallans } from '../services/challans.ts';
import { listCustomers } from '../services/customers.ts';
import { listInventory } from '../services/inventory.ts';
import { ApiClientError } from '../types/api.ts';
import type { Challan } from '../types/challan.ts';
import type { Customer } from '../types/customer.ts';
import type { InventorySummary, Product } from '../types/product.ts';
import { formatDate } from '../utils/dates.ts';

const EMPTY_SUMMARY: InventorySummary = { total: 0, healthy: 0, low: 0, critical: 0 };

export function DashboardPage() {
  const health = useHealth();
  const { user } = useAuth();
  const canCustomers = user?.role === 'ADMIN' || user?.role === 'SALES';
  const canChallans = canManageChallans(user?.role);
  const canProducts = canManageProducts(user?.role);

  const [opsStatus, setOpsStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [opsError, setOpsError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [summary, setSummary] = useState<InventorySummary>(EMPTY_SUMMARY);
  const [stockAlerts, setStockAlerts] = useState<Product[]>([]);
  const [recentChallans, setRecentChallans] = useState<Challan[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [customerTotal, setCustomerTotal] = useState<number | null>(null);
  const [overdueFollowUps, setOverdueFollowUps] = useState<Customer[]>([]);

  useEffect(() => {
    let aborted = false;

    Promise.all([
      listInventory({ page: 1, pageSize: 8, sortBy: 'currentStock', sortOrder: 'asc' }),
      listChallans({ page: 1, pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' }),
      listChallans({ page: 1, pageSize: 1, status: 'DRAFT' }),
      listChallans({ page: 1, pageSize: 1, status: 'CONFIRMED' }),
      listChallans({ page: 1, pageSize: 1, status: 'CANCELLED' }),
      canCustomers
        ? listCustomers({ page: 1, pageSize: 1, sortBy: 'updatedAt', sortOrder: 'desc' })
        : Promise.resolve(null),
      canCustomers
        ? listCustomers({
            page: 1,
            pageSize: 5,
            followUp: 'overdue',
            sortBy: 'followUpDate',
            sortOrder: 'asc',
          })
        : Promise.resolve(null),
    ])
      .then(([inventory, recent, drafts, confirmed, cancelledList, customers, overdue]) => {
        if (aborted) return;
        setSummary(inventory.summary);
        setStockAlerts(inventory.products.filter((item) => item.stockStatus !== 'HEALTHY'));
        setRecentChallans(recent.challans);
        setDraftCount(drafts.pagination.total);
        setConfirmedCount(confirmed.pagination.total);
        setCancelledCount(cancelledList.pagination.total);
        setCustomerTotal(customers?.pagination.total ?? null);
        setOverdueFollowUps(overdue?.customers ?? []);
        setOpsStatus('success');
      })
      .catch((reason: unknown) => {
        if (aborted) return;
        setOpsError(reason instanceof ApiClientError ? reason.message : 'Unable to load operational data.');
        setOpsStatus('error');
      });

    return () => {
      aborted = true;
    };
  }, [canCustomers, retryKey]);

  const apiDown = health.status === 'error';
  const showSkeleton = !apiDown && (health.status === 'loading' || opsStatus === 'loading');
  const opsFailed = !apiDown && opsStatus === 'error';
  const ready = health.status === 'success' && opsStatus === 'success';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live operational snapshot from customers, inventory, and sales challans."
      />

      {showSkeleton ? <PageSkeleton /> : null}

      {apiDown ? (
        <ErrorState
          title="Unable to reach the API"
          description={health.error ?? 'The health endpoint did not respond.'}
          onRetry={() => {
            health.retry();
            setOpsStatus('loading');
            setRetryKey((value) => value + 1);
          }}
        />
      ) : null}

      {opsFailed ? (
        <ErrorState
          title="Unable to load dashboard"
          description={opsError ?? 'Operational data did not load.'}
          onRetry={() => {
            setOpsStatus('loading');
            setRetryKey((value) => value + 1);
          }}
        />
      ) : null}

      {ready ? (
        <div className="space-y-8">
          <dl className="kpi-strip grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {customerTotal !== null ? (
              <KpiStat label="Customers" value={customerTotal} hint="CRM records" />
            ) : null}
            <KpiStat label="Products" value={summary.total} hint="Catalog positions" />
            <KpiStat
              label="Low stock"
              value={summary.low}
              hint="At or below minimum"
              tone={summary.low > 0 ? 'warning' : 'default'}
            />
            <KpiStat
              label="Out of stock"
              value={summary.critical}
              hint="Zero on hand"
              tone={summary.critical > 0 ? 'danger' : 'default'}
            />
            <KpiStat label="Draft challans" value={draftCount} hint="Not yet confirmed" />
            <KpiStat label="Confirmed challans" value={confirmedCount} hint="Stock deducted" />
          </dl>

          <div className="flex flex-wrap items-center gap-2 text-caption">
            <span>API</span>
            <Badge tone="success">Healthy</Badge>
            <span>
              {health.data?.service} · {health.data?.environment}
              {user ? ` · ${user.role}` : ''}
            </span>
            {cancelledCount > 0 ? <span>· {cancelledCount} cancelled challans</span> : null}
          </div>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-section">Quick actions</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {canChallans ? (
                <Link to={challanNewPath}>
                  <Button>Create challan</Button>
                </Link>
              ) : null}
              {canCustomers ? (
                <Link to={paths.customers}>
                  <Button variant={canChallans ? 'secondary' : 'primary'}>Customers</Button>
                </Link>
              ) : null}
              {canCustomers ? (
                <Link to={paths.crm}>
                  <Button variant="secondary">CRM / Follow-ups</Button>
                </Link>
              ) : null}
              {canProducts ? (
                <Link to={paths.products}>
                  <Button variant="secondary">Products</Button>
                </Link>
              ) : null}
              <Link to={paths.inventory}>
                <Button variant="secondary">Inventory</Button>
              </Link>
              <Link to={paths.challans}>
                <Button variant="secondary">Sales challans</Button>
              </Link>
            </div>
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-section">Stock alerts</h2>
                <Link to={paths.inventory} className="text-sm font-medium text-primary hover:text-primary-hover">
                  Open inventory
                </Link>
              </div>
              {stockAlerts.length === 0 ? (
                <EmptyState
                  title="No stock alerts"
                  description="Products currently on the lowest-stock list are healthy. Low and out-of-stock items will appear here first."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {stockAlerts.map((product) => (
                    <li key={product.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link to={productPath(product.id)} className="font-medium text-ink hover:text-primary">
                          {product.name}
                        </Link>
                        <p className="text-caption">
                          {product.sku} · {product.currentStock} on hand · min {product.minStock}
                          {product.location ? ` · ${product.location}` : ''}
                        </p>
                      </div>
                      <StockStatusBadge status={product.stockStatus} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-section">Recent challans</h2>
                <Link to={paths.challans} className="text-sm font-medium text-primary hover:text-primary-hover">
                  View all
                </Link>
              </div>
              {recentChallans.length === 0 ? (
                <EmptyState
                  title="No challans yet"
                  description="Confirmed and draft challans will appear here as they are created."
                  action={
                    canChallans ? (
                      <Link to={challanNewPath}>
                        <Button>Create challan</Button>
                      </Link>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {recentChallans.map((challan) => (
                    <li key={challan.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link to={challanPath(challan.id)} className="font-medium text-ink hover:text-primary">
                          {challan.challanNumber}
                        </Link>
                        <p className="text-caption">
                          {challan.customer.name} · {challan.totalQuantity} units · {formatDate(challan.createdAt)}
                        </p>
                      </div>
                      <ChallanStatusBadge status={challan.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {canCustomers ? (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-section">Overdue follow-ups</h2>
                <Link
                  to={`${paths.crm}?followUp=overdue`}
                  className="text-sm font-medium text-primary hover:text-primary-hover"
                >
                  Open CRM
                </Link>
              </div>
              {overdueFollowUps.length === 0 ? (
                <EmptyState
                  title="No overdue follow-ups"
                  description="Customers with a follow-up date in the past will appear here."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {overdueFollowUps.map((customer) => (
                    <li key={customer.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link to={customerPath(customer.id)} className="font-medium text-ink hover:text-primary">
                          {customer.name}
                        </Link>
                        <p className="text-caption">{customer.businessName || customer.mobile}</p>
                      </div>
                      <FollowUpDate value={customer.followUpDate} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
