import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { CustomerFormModal } from '../components/customers/CustomerFormModal.tsx';
import { CustomerStatusBadge, FollowUpDate } from '../components/customers/customerDisplay.tsx';
import { CUSTOMER_TYPE_LABELS } from '../constants/customer.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { customerPath } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { createCustomer, listCustomers, updateCustomer } from '../services/customers.ts';
import { ApiClientError } from '../types/api.ts';
import type {
  Customer,
  CustomerStatus,
  CustomerType,
  CustomerWritePayload,
  FollowUpFilter,
  PaginationMeta,
} from '../types/customer.ts';
import { formatDate } from '../utils/dates.ts';

function readParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? '';
}

export function CustomersPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(readParam(searchParams, 'search'));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const filters = useMemo(
    () => ({
      search: readParam(searchParams, 'search'),
      status: readParam(searchParams, 'status') as CustomerStatus | '',
      customerType: readParam(searchParams, 'customerType') as CustomerType | '',
      followUp: readParam(searchParams, 'followUp') as FollowUpFilter | '',
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

    listCustomers({
      page: filters.page,
      pageSize: 20,
      search: filters.search || undefined,
      status: filters.status || undefined,
      customerType: filters.customerType || undefined,
      followUp: filters.followUp || undefined,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })
      .then((result) => {
        if (cancelled) return;
        setCustomers(result.customers);
        setPagination(result.pagination);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiClientError && reason.status === 403) {
          setForbidden(true);
        }
        setError(reason instanceof ApiClientError ? reason.message : 'Unable to load customers.');
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

  async function handleSave(payload: CustomerWritePayload) {
    if (editing) {
      await updateCustomer(editing.id, payload);
      pushToast({ title: 'Customer updated', tone: 'success' });
    } else {
      await createCustomer(payload);
      pushToast({ title: 'Customer added', tone: 'success' });
    }
    setFormOpen(false);
    setEditing(null);
    setReloadToken((value) => value + 1);
  }

  const hasFilters = Boolean(filters.search || filters.status || filters.customerType || filters.followUp);
  const canManage = user?.role === 'ADMIN' || user?.role === 'SALES';

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Accounts, leads, and follow-up work for the sales pipeline."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add customer
            </Button>
          ) : null
        }
      />

      {forbidden ? (
        <ErrorState
          title="You cannot access customers"
          description="Customer records are available to Admin and Sales roles."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <Input
              label="Search"
              name="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, mobile, email, business"
            />
            <Select
              label="Status"
              name="status"
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'LEAD', label: 'Lead' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
            <Select
              label="Type"
              name="customerType"
              value={filters.customerType}
              onChange={(event) => updateFilter('customerType', event.target.value)}
              options={[
                { value: '', label: 'All types' },
                { value: 'RETAIL', label: 'Retail' },
                { value: 'WHOLESALE', label: 'Wholesale' },
                { value: 'DISTRIBUTOR', label: 'Distributor' },
              ]}
            />
            <Select
              label="Follow-up"
              name="followUp"
              value={filters.followUp}
              onChange={(event) => updateFilter('followUp', event.target.value)}
              options={[
                { value: '', label: 'Any follow-up' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'dueToday', label: 'Due today' },
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'none', label: 'No date' },
              ]}
            />
          </div>

          {status === 'loading' ? <CustomerListSkeleton /> : null}

          {status === 'error' && !forbidden ? (
            <ErrorState
              title="Unable to load customers"
              description={error ?? 'The customer list did not load.'}
              onRetry={() => setReloadToken((value) => value + 1)}
            />
          ) : null}

          {status === 'success' && customers.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No matching customers' : 'No customers yet'}
              description={
                hasFilters
                  ? 'Nothing matches the current search or filters.'
                  : 'Add a customer to start the sales and follow-up pipeline.'
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
                    Add customer
                  </Button>
                ) : null
              }
            />
          ) : null}

          {status === 'success' && customers.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-caption">
                      <th className="py-2 pr-4 font-medium">Customer</th>
                      <th className="py-2 pr-4 font-medium">Business</th>
                      <th className="py-2 pr-4 font-medium">Contact</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Follow-up</th>
                      <th className="py-2 pr-4 font-medium">Activity</th>
                      <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id} className="border-b border-line last:border-b-0">
                        <td className="py-3 pr-4">
                          <Link to={customerPath(customer.id)} className="font-medium text-ink hover:text-primary">
                            {customer.name}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-secondary">{customer.businessName || '—'}</td>
                        <td className="py-3 pr-4">
                          <div className="text-ink">{customer.mobile}</div>
                          <div className="text-caption">{customer.email || 'No email'}</div>
                        </td>
                        <td className="py-3 pr-4 text-secondary">{CUSTOMER_TYPE_LABELS[customer.customerType]}</td>
                        <td className="py-3 pr-4">
                          <CustomerStatusBadge status={customer.status} />
                        </td>
                        <td className="py-3 pr-4">
                          <FollowUpDate value={customer.followUpDate} />
                        </td>
                        <td className="py-3 pr-4 text-secondary">{formatDate(customer.latestFollowUpAt)}</td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            <Link to={customerPath(customer.id)} className="text-sm font-medium text-primary hover:text-primary-hover">
                              View
                            </Link>
                            {canManage ? (
                              <button
                                type="button"
                                className="text-sm font-medium text-ink-secondary hover:text-ink"
                                onClick={() => {
                                  setEditing(customer);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {customers.map((customer) => (
                  <li key={customer.id} className="border-b border-line pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={customerPath(customer.id)} className="font-medium text-ink hover:text-primary">
                          {customer.name}
                        </Link>
                        <p className="text-secondary">{customer.businessName || CUSTOMER_TYPE_LABELS[customer.customerType]}</p>
                        <p className="mt-1 text-caption">
                          {customer.mobile}
                          {customer.email ? ` · ${customer.email}` : ''}
                        </p>
                      </div>
                      <CustomerStatusBadge status={customer.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <FollowUpDate value={customer.followUpDate} />
                      {canManage ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-ink-secondary hover:text-ink"
                          onClick={() => {
                            setEditing(customer);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              {pagination ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-caption">
                    {pagination.total} customers · page {pagination.page}
                    {pagination.totalPages ? ` of ${pagination.totalPages}` : ''}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.hasPrevious}
                      onClick={() => setPage(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.hasNext}
                      onClick={() => setPage(pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {formOpen ? (
        <CustomerFormModal
          open
          customer={editing}
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

function CustomerListSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
      <span className="sr-only">Loading customers</span>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  );
}
