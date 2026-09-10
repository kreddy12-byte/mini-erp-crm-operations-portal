import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FollowUpModal } from '../components/customers/FollowUpModal.tsx';
import {
  CustomerStatusBadge,
  FollowUpDate,
  FollowUpStateBadge,
} from '../components/customers/customerDisplay.tsx';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { KpiStat } from '../components/ui/KpiStat.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PaginationBar } from '../components/ui/PaginationBar.tsx';
import { Select } from '../components/ui/Select.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import { canAccessCrm, CUSTOMER_TYPE_LABELS } from '../constants/customer.ts';
import { customerPath, paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { createCustomerFollowUp, listCustomers } from '../services/customers.ts';
import { ApiClientError } from '../types/api.ts';
import type {
  CreateFollowUpPayload,
  Customer,
  CustomerStatus,
  CustomerType,
  FollowUpFilter,
  PaginationMeta,
} from '../types/customer.ts';
import { formatDate } from '../utils/dates.ts';

function readParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? '';
}

interface CrmSummary {
  overdue: number;
  dueToday: number;
  upcoming: number;
  none: number;
  lead: number;
  active: number;
}

const EMPTY_SUMMARY: CrmSummary = {
  overdue: 0,
  dueToday: 0,
  upcoming: 0,
  none: 0,
  lead: 0,
  active: 0,
};

export function CrmPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canAccessCrm(user?.role);
  const [searchInput, setSearchInput] = useState(readParam(searchParams, 'search'));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<CrmSummary>(EMPTY_SUMMARY);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [summaryStatus, setSummaryStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [apiForbidden, setApiForbidden] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [followUpFor, setFollowUpFor] = useState<Customer | null>(null);
  const forbidden = !canManage || apiForbidden;

  const filters = useMemo(
    () => ({
      search: readParam(searchParams, 'search'),
      status: readParam(searchParams, 'status') as CustomerStatus | '',
      customerType: readParam(searchParams, 'customerType') as CustomerType | '',
      // Default the CRM queue to overdue attention when the URL has no follow-up filter.
      followUp: (readParam(searchParams, 'followUp') || 'overdue') as FollowUpFilter | '',
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
    if (!canManage) return;
    let cancelled = false;

    // KPI totals reuse list pagination.total — no dedicated CRM overview endpoint.
    Promise.all([
      listCustomers({ page: 1, pageSize: 1, followUp: 'overdue' }),
      listCustomers({ page: 1, pageSize: 1, followUp: 'dueToday' }),
      listCustomers({ page: 1, pageSize: 1, followUp: 'upcoming' }),
      listCustomers({ page: 1, pageSize: 1, followUp: 'none' }),
      listCustomers({ page: 1, pageSize: 1, status: 'LEAD' }),
      listCustomers({ page: 1, pageSize: 1, status: 'ACTIVE' }),
    ])
      .then(([overdue, dueToday, upcoming, none, lead, active]) => {
        if (cancelled) return;
        setSummary({
          overdue: overdue.pagination.total,
          dueToday: dueToday.pagination.total,
          upcoming: upcoming.pagination.total,
          none: none.pagination.total,
          lead: lead.pagination.total,
          active: active.pagination.total,
        });
        setSummaryStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiClientError && reason.status === 403) {
          setApiForbidden(true);
        }
        setSummaryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, reloadToken]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;

    listCustomers({
      page: filters.page,
      pageSize: 20,
      search: filters.search || undefined,
      status: filters.status || undefined,
      customerType: filters.customerType || undefined,
      followUp: filters.followUp || undefined,
      sortBy: 'followUpDate',
      sortOrder: 'asc',
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
          setApiForbidden(true);
        }
        setError(reason instanceof ApiClientError ? reason.message : 'Unable to load the CRM queue.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, filters, reloadToken]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  function setFollowUpBucket(value: FollowUpFilter) {
    const next = new URLSearchParams(searchParams);
    next.set('followUp', value);
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
    setSearchParams(new URLSearchParams({ followUp: 'overdue' }));
  }

  async function handleFollowUp(payload: CreateFollowUpPayload) {
    if (!followUpFor) return;
    await createCustomerFollowUp(followUpFor.id, payload);
    setFollowUpFor(null);
    pushToast({ title: 'Follow-up added', tone: 'success' });
    setReloadToken((value) => value + 1);
  }

  const hasExtraFilters = Boolean(filters.search || filters.status || filters.customerType);
  const queueEmptyTitle =
    filters.followUp === 'overdue'
      ? 'No overdue follow-ups'
      : filters.followUp === 'dueToday'
        ? 'Nothing due today'
        : filters.followUp === 'upcoming'
          ? 'No upcoming follow-ups'
          : filters.followUp === 'none'
            ? 'Every customer has a follow-up date'
            : 'No matching customers';

  if (forbidden || !canManage) {
    return (
      <div>
        <PageHeader title="CRM / Follow-ups" description="Sales follow-up queue for leads and active accounts." />
        <ErrorState
          title="You cannot access CRM"
          description="CRM and customer follow-ups are available to Admin and Sales roles."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="CRM / Follow-ups"
        description="Who needs attention, when they are due, and what happened last."
        actions={
          <Link to={paths.customers}>
            <Button variant="secondary">Open customers</Button>
          </Link>
        }
      />

      {summaryStatus === 'loading' && status === 'loading' ? <TableSkeleton label="Loading CRM" rows={5} /> : null}

      {summaryStatus === 'success' ? (
        <div className="kpi-strip grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <button type="button" className="rounded-md text-left focus-visible:outline-none" onClick={() => setFollowUpBucket('overdue')}>
            <KpiStat
              label="Overdue"
              value={summary.overdue}
              hint="Past due date"
              tone={summary.overdue > 0 ? 'danger' : 'default'}
            />
          </button>
          <button type="button" className="rounded-md text-left focus-visible:outline-none" onClick={() => setFollowUpBucket('dueToday')}>
            <KpiStat
              label="Due today"
              value={summary.dueToday}
              hint="Needs contact today"
              tone={summary.dueToday > 0 ? 'warning' : 'default'}
            />
          </button>
          <button type="button" className="rounded-md text-left focus-visible:outline-none" onClick={() => setFollowUpBucket('upcoming')}>
            <KpiStat label="Upcoming" value={summary.upcoming} hint="Scheduled ahead" />
          </button>
          <button type="button" className="rounded-md text-left focus-visible:outline-none" onClick={() => setFollowUpBucket('none')}>
            <KpiStat label="No follow-up" value={summary.none} hint="No date scheduled" />
          </button>
          <KpiStat label="Leads" value={summary.lead} hint="CRM status LEAD" />
          <KpiStat label="Active" value={summary.active} hint="CRM status ACTIVE" />
        </div>
      ) : null}

      <div className="filter-panel grid gap-3 md:grid-cols-4">
        <Input
          label="Search"
          name="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Name, mobile, email, business"
        />
        <Select
          label="Follow-up"
          name="followUp"
          value={filters.followUp}
          onChange={(event) => updateFilter('followUp', event.target.value)}
          options={[
            { value: 'overdue', label: 'Overdue' },
            { value: 'dueToday', label: 'Due today' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'none', label: 'No follow-up' },
          ]}
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
      </div>

      {hasExtraFilters ? (
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset to overdue queue
          </Button>
        </div>
      ) : null}

      {status === 'loading' ? <TableSkeleton label="Loading follow-up queue" /> : null}

      {status === 'error' && !forbidden ? (
        <ErrorState
          title="Unable to load CRM queue"
          description={error ?? 'The follow-up queue did not load.'}
          onRetry={() => setReloadToken((value) => value + 1)}
        />
      ) : null}

      {status === 'success' && customers.length === 0 ? (
        <EmptyState
          title={queueEmptyTitle}
          description={
            hasExtraFilters
              ? 'Nothing matches the current search or filters.'
              : 'When customers need attention in this bucket, they will appear here.'
          }
          action={
            hasExtraFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset to overdue queue
              </Button>
            ) : (
              <Link to={paths.customers}>
                <Button variant="secondary">Browse customers</Button>
              </Link>
            )
          }
        />
      ) : null}

      {status === 'success' && customers.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-[56rem]">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Business</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                  <th>State</th>
                  <th>Last note</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link to={customerPath(customer.id)} className="font-medium text-ink hover:text-primary">
                        {customer.name}
                      </Link>
                      <div className="text-caption">{customer.mobile}</div>
                    </td>
                    <td className="text-secondary">{customer.businessName || '—'}</td>
                    <td className="text-secondary">{CUSTOMER_TYPE_LABELS[customer.customerType]}</td>
                    <td>
                      <CustomerStatusBadge status={customer.status} />
                    </td>
                    <td>
                      <FollowUpDate value={customer.followUpDate} />
                    </td>
                    <td>
                      <FollowUpStateBadge value={customer.followUpDate} />
                    </td>
                    <td>
                      <p className="max-w-56 truncate text-secondary" title={customer.notes || undefined}>
                        {customer.notes || '—'}
                      </p>
                      <p className="text-caption">
                        {customer.latestFollowUpAt ? `Activity ${formatDate(customer.latestFollowUpAt)}` : 'No activity'}
                      </p>
                    </td>
                    <td>
                      <div className="flex justify-end gap-3">
                        <Link
                          to={customerPath(customer.id)}
                          className="text-sm font-medium text-primary hover:text-primary-hover"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          className="text-sm font-medium text-ink-secondary hover:text-ink"
                          onClick={() => setFollowUpFor(customer)}
                        >
                          Add follow-up
                        </button>
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
                  <div className="min-w-0">
                    <Link to={customerPath(customer.id)} className="font-medium text-ink hover:text-primary">
                      {customer.name}
                    </Link>
                    <p className="text-secondary">{customer.businessName || CUSTOMER_TYPE_LABELS[customer.customerType]}</p>
                    <p className="mt-1 text-caption">{customer.notes || 'No current note'}</p>
                  </div>
                  <FollowUpStateBadge value={customer.followUpDate} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <FollowUpDate value={customer.followUpDate} />
                  <div className="flex gap-3">
                    <Link to={customerPath(customer.id)} className="text-sm font-medium text-primary">
                      View
                    </Link>
                    <button
                      type="button"
                      className="text-sm font-medium text-ink-secondary hover:text-ink"
                      onClick={() => setFollowUpFor(customer)}
                    >
                      Add follow-up
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {pagination ? <PaginationBar pagination={pagination} noun="customers" onPage={setPage} /> : null}
        </>
      ) : null}

      {followUpFor ? (
        <FollowUpModal
          open
          customerLabel={followUpFor.name}
          onClose={() => setFollowUpFor(null)}
          onSubmit={handleFollowUp}
        />
      ) : null}
    </div>
  );
}
