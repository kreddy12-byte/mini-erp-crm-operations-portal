import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChallanCancelModal } from '../components/challans/ChallanCancelModal.tsx';
import { ChallanConfirmModal } from '../components/challans/ChallanConfirmModal.tsx';
import { ChallanStatusBadge } from '../components/challans/ChallanStatusBadge.tsx';
import { describeChallanError } from '../components/challans/challanErrors.ts';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Dropdown } from '../components/ui/Dropdown.tsx';
import { Input } from '../components/ui/Input.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PaginationBar } from '../components/ui/PaginationBar.tsx';
import { Select } from '../components/ui/Select.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import { canManageChallans, canViewCustomersForChallans } from '../constants/challan.ts';
import { challanNewPath, challanPath } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { cancelChallan, confirmChallan, listChallans } from '../services/challans.ts';
import { listCustomers } from '../services/customers.ts';
import type { Challan, ChallanSortField, ChallanStatus, PaginationMeta, SortOrder } from '../types/challan.ts';
import type { Customer } from '../types/customer.ts';
import { formatDate } from '../utils/dates.ts';

function readParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? '';
}

export function ChallansPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(readParam(searchParams, 'search'));
  const [challans, setChallans] = useState<Challan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Challan | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Challan | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const canManage = canManageChallans(user?.role);
  const canFilterCustomers = canViewCustomersForChallans(user?.role);

  const filters = useMemo(
    () => ({
      search: readParam(searchParams, 'search'),
      status: readParam(searchParams, 'status') as ChallanStatus | '',
      customerId: readParam(searchParams, 'customerId'),
      sortBy: (readParam(searchParams, 'sortBy') || 'createdAt') as ChallanSortField,
      sortOrder: (readParam(searchParams, 'sortOrder') || 'desc') as SortOrder,
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
    if (!canFilterCustomers) return;
    listCustomers({ page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'asc' })
      .then((result) => setCustomers(result.customers))
      .catch(() => setCustomers([]));
  }, [canFilterCustomers]);

  useEffect(() => {
    let cancelled = false;

    listChallans({
      page: filters.page,
      pageSize: 20,
      search: filters.search || undefined,
      status: filters.status || undefined,
      customerId: filters.customerId || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })
      .then((result) => {
        if (cancelled) return;
        setChallans(result.challans);
        setPagination(result.pagination);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const copy = describeChallanError(reason, 'Unable to load challans');
        setError(copy.description);
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

  async function handleConfirm() {
    if (!confirmTarget || actionLoading) return;
    setActionLoading(true);
    try {
      await confirmChallan(confirmTarget.id);
      pushToast({ title: 'Challan confirmed', description: 'Stock was deducted and movements were recorded.', tone: 'success' });
      setConfirmTarget(null);
      setReloadToken((value) => value + 1);
    } catch (reason: unknown) {
      const copy = describeChallanError(reason, 'Unable to confirm challan');
      pushToast({ title: copy.title, description: copy.description, tone: 'danger' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget || actionLoading) return;
    setActionLoading(true);
    try {
      await cancelChallan(cancelTarget.id);
      pushToast({ title: 'Draft cancelled', tone: 'success' });
      setCancelTarget(null);
      setReloadToken((value) => value + 1);
    } catch (reason: unknown) {
      const copy = describeChallanError(reason, 'Unable to cancel challan');
      pushToast({ title: copy.title, description: copy.description, tone: 'danger' });
    } finally {
      setActionLoading(false);
    }
  }

  const hasFilters = Boolean(filters.search || filters.status || filters.customerId);

  return (
    <div>
      <PageHeader
        title="Sales Challans"
        description="Draft, confirm, and review delivery challans against live stock."
        actions={
          canManage ? (
            <Button onClick={() => navigate(challanNewPath)}>Create challan</Button>
          ) : null
        }
      />

      <div className="filter-panel grid gap-3 md:grid-cols-4">
        <Input
          label="Search"
          name="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Challan number or customer"
        />
        <Select
          label="Status"
          name="status"
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'CONFIRMED', label: 'Confirmed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
        {canFilterCustomers ? (
          <Select
            label="Customer"
            name="customerId"
            value={filters.customerId}
            onChange={(event) => updateFilter('customerId', event.target.value)}
            options={[
              { value: '', label: 'All customers' },
              ...customers.map((customer) => ({
                value: customer.id,
                label: customer.businessName ? `${customer.name} · ${customer.businessName}` : customer.name,
              })),
            ]}
          />
        ) : (
          <Select
            label="Sort"
            name="sortBy"
            value={filters.sortBy}
            onChange={(event) => updateFilter('sortBy', event.target.value)}
            options={[
              { value: 'createdAt', label: 'Created date' },
              { value: 'challanNumber', label: 'Challan number' },
              { value: 'totalQuantity', label: 'Total quantity' },
              { value: 'status', label: 'Status' },
            ]}
          />
        )}
        <Select
          label={canFilterCustomers ? 'Sort' : 'Order'}
          name={canFilterCustomers ? 'sortBy' : 'sortOrder'}
          value={canFilterCustomers ? filters.sortBy : filters.sortOrder}
          onChange={(event) => updateFilter(canFilterCustomers ? 'sortBy' : 'sortOrder', event.target.value)}
          options={
            canFilterCustomers
              ? [
                  { value: 'createdAt', label: 'Created date' },
                  { value: 'challanNumber', label: 'Challan number' },
                  { value: 'totalQuantity', label: 'Total quantity' },
                  { value: 'status', label: 'Status' },
                ]
              : [
                  { value: 'desc', label: 'Newest first' },
                  { value: 'asc', label: 'Oldest first' },
                ]
          }
        />
      </div>

      {hasFilters ? (
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}

      {status === 'loading' ? <TableSkeleton label="Loading challans" /> : null}

      {status === 'error' ? (
        <ErrorState
          title="Unable to load challans"
          description={error ?? 'The challan list did not load.'}
          onRetry={() => setReloadToken((value) => value + 1)}
        />
      ) : null}

      {status === 'success' && challans.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No matching challans' : 'No sales challans yet'}
          description={
            hasFilters
              ? 'Nothing matches the current search or filters.'
              : 'Create a draft to reserve a customer and products without deducting stock.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : canManage ? (
              <Button onClick={() => navigate(challanNewPath)}>Create challan</Button>
            ) : null
          }
        />
      ) : null}

      {status === 'success' && challans.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-[56rem]">
              <thead>
                <tr>
                  <th>Challan</th>
                  <th>Customer</th>
                  <th className="cell-num">Qty</th>
                  <th>Status</th>
                  <th>Created by</th>
                  <th>Created</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {challans.map((challan) => (
                  <tr key={challan.id}>
                    <td>
                      <Link to={challanPath(challan.id)} className="font-medium text-ink hover:text-primary">
                        {challan.challanNumber}
                      </Link>
                    </td>
                    <td>
                      <div className="text-ink">{challan.customer.name}</div>
                      <div className="text-caption">{challan.customer.businessName || '—'}</div>
                    </td>
                    <td className="cell-num text-ink">{challan.totalQuantity}</td>
                    <td>
                      <ChallanStatusBadge status={challan.status} />
                    </td>
                    <td className="text-secondary">{challan.createdBy.name}</td>
                    <td className="text-secondary">{formatDate(challan.createdAt)}</td>
                    <td>
                      <div className="flex justify-end">
                        <Dropdown
                          label={`Actions for ${challan.challanNumber}`}
                          trigger={
                            <span className="text-sm font-medium text-primary hover:text-primary-hover">Actions</span>
                          }
                          items={[
                            { id: 'view', label: 'View', onSelect: () => navigate(challanPath(challan.id)) },
                            ...(canManage && challan.status === 'DRAFT'
                              ? [
                                  {
                                    id: 'edit',
                                    label: 'Edit',
                                    onSelect: () => navigate(`${challanPath(challan.id)}?edit=1`),
                                  },
                                  {
                                    id: 'confirm',
                                    label: 'Confirm',
                                    onSelect: () => {
                                      setActionId(challan.id);
                                      setConfirmTarget(challan);
                                    },
                                  },
                                  {
                                    id: 'cancel',
                                    label: 'Cancel draft',
                                    tone: 'danger' as const,
                                    onSelect: () => {
                                      setActionId(challan.id);
                                      setCancelTarget(challan);
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
            {challans.map((challan) => (
              <li key={challan.id} className="border-b border-line pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={challanPath(challan.id)} className="font-medium text-ink hover:text-primary">
                      {challan.challanNumber}
                    </Link>
                    <p className="text-secondary">{challan.customer.name}</p>
                    <p className="mt-1 text-caption">
                      {challan.totalQuantity} units · {challan.createdBy.name} · {formatDate(challan.createdAt)}
                    </p>
                  </div>
                  <ChallanStatusBadge status={challan.status} />
                </div>
                {canManage && challan.status === 'DRAFT' ? (
                  <div className="mt-2 flex gap-3">
                    <Link to={`${challanPath(challan.id)}?edit=1`} className="text-sm font-medium text-primary">
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="text-sm font-medium text-ink-secondary hover:text-ink"
                      onClick={() => setConfirmTarget(challan)}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-danger hover:text-danger/80"
                      onClick={() => setCancelTarget(challan)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {pagination ? (
            <PaginationBar pagination={pagination} noun="challans" onPage={setPage} />
          ) : null}
        </>
      ) : null}

      <ChallanConfirmModal
        open={Boolean(confirmTarget)}
        loading={actionLoading && actionId === confirmTarget?.id}
        challanNumber={confirmTarget?.challanNumber}
        onClose={() => {
          if (actionLoading) return;
          setConfirmTarget(null);
        }}
        onConfirm={handleConfirm}
      />
      <ChallanCancelModal
        open={Boolean(cancelTarget)}
        loading={actionLoading && actionId === cancelTarget?.id}
        challanNumber={cancelTarget?.challanNumber}
        onClose={() => {
          if (actionLoading) return;
          setCancelTarget(null);
        }}
        onConfirm={handleCancel}
      />
    </div>
  );
}
