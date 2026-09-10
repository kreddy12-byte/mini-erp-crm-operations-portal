import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChallanStatusBadge } from '../components/challans/ChallanStatusBadge.tsx';
import { CustomerFormModal } from '../components/customers/CustomerFormModal.tsx';
import { FollowUpModal } from '../components/customers/FollowUpModal.tsx';
import { CustomerStatusBadge, FollowUpDate } from '../components/customers/customerDisplay.tsx';
import { CUSTOMER_TYPE_LABELS } from '../constants/customer.ts';
import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PageSkeleton } from '../components/ui/Skeleton.tsx';
import { challanNewPath, challanPath, paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { listChallans } from '../services/challans.ts';
import {
  createCustomerFollowUp,
  getCustomer,
  listCustomerFollowUps,
  updateCustomer,
} from '../services/customers.ts';
import { ApiClientError } from '../types/api.ts';
import type { Challan } from '../types/challan.ts';
import type { CreateFollowUpPayload, Customer, CustomerFollowUp, CustomerWritePayload } from '../types/customer.ts';
import { formatDate, formatDateTime } from '../utils/dates.ts';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [retryKey, setRetryKey] = useState(0);

  if (!id) {
    return (
      <div>
        <PageHeader title="Customer" description="This record could not be opened." />
        <ErrorState title="Customer not found" description="The customer id is missing." />
      </div>
    );
  }

  return <CustomerDetailRecord key={`${id}-${retryKey}`} id={id} onRetry={() => setRetryKey((value) => value + 1)} />;
}

function CustomerDetailRecord({ id, onRetry }: { id: string; onRetry: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [followUps, setFollowUps] = useState<CustomerFollowUp[]>([]);
  const [relatedChallans, setRelatedChallans] = useState<Challan[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const canManage = user?.role === 'ADMIN' || user?.role === 'SALES';

  useEffect(() => {
    let cancelled = false;

    getCustomer(id)
      .then((record) => {
        if (cancelled) return;
        setCustomer(record);
        setFollowUps(record.followUps ?? []);
        setStatus('success');
        listChallans({
          page: 1,
          pageSize: 6,
          customerId: id,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })
          .then((result) => {
            if (!cancelled) setRelatedChallans(result.challans);
          })
          .catch(() => {
            if (!cancelled) setRelatedChallans([]);
          });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setNotFound(reason instanceof ApiClientError && reason.status === 404);
        setForbidden(reason instanceof ApiClientError && reason.status === 403);
        setError(reason instanceof ApiClientError ? reason.message : 'Unable to load this customer.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(payload: CustomerWritePayload) {
    if (!customer) return;
    const updated = await updateCustomer(customer.id, payload);
    setCustomer({ ...customer, ...updated });
    setEditOpen(false);
    pushToast({ title: 'Customer updated', tone: 'success' });
  }

  async function handleFollowUp(payload: CreateFollowUpPayload) {
    if (!customer) return;
    await createCustomerFollowUp(customer.id, payload);
    const [record, history] = await Promise.all([getCustomer(customer.id), listCustomerFollowUps(customer.id)]);
    setCustomer(record);
    setFollowUps(history);
    setFollowUpOpen(false);
    pushToast({ title: 'Follow-up added', tone: 'success' });
  }

  if (status === 'loading') {
    return (
      <div>
        <PageHeader title="Customer" description="Loading record." />
        <PageSkeleton />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div>
        <PageHeader title="Customer" description="This record could not be opened." />
        <p className="mb-4">
          <Link to={paths.customers} className="text-sm font-medium text-primary hover:text-primary-hover">
            Back to customers
          </Link>
        </p>
        <ErrorState
          title={
            forbidden ? 'You cannot access customers' : notFound ? 'Customer not found' : 'Unable to load customer'
          }
          description={
            forbidden
              ? 'Customer records are available to Admin and Sales roles.'
              : error ?? 'This customer could not be loaded.'
          }
          onRetry={notFound || forbidden ? undefined : onRetry}
        />
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={customer.businessName || CUSTOMER_TYPE_LABELS[customer.customerType]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(paths.customers)}>
              Back to list
            </Button>
            {canManage ? (
              <>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button onClick={() => setFollowUpOpen(true)}>Add follow-up</Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <CustomerStatusBadge status={customer.status} />
        <span className="text-secondary">{CUSTOMER_TYPE_LABELS[customer.customerType]}</span>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="text-section">Contact</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="Mobile" value={customer.mobile} />
              <Info label="Email" value={customer.email || '—'} />
            </dl>
          </section>

          <section>
            <h2 className="text-section">Business</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="Business name" value={customer.businessName || '—'} />
              <Info label="GST" value={customer.gstNumber || '—'} />
              <Info label="Address" value={customer.address || '—'} className="sm:col-span-2" />
            </dl>
          </section>

          <section>
            <h2 className="text-section">CRM</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-caption">Follow-up</dt>
                <dd className="mt-1">
                  <FollowUpDate value={customer.followUpDate} />
                </dd>
              </div>
              <Info label="Current notes" value={customer.notes || 'No current note'} className="sm:col-span-2" />
            </dl>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-section">Related challans</h2>
              {canManage ? (
                <Link to={challanNewPath} className="text-sm font-medium text-primary hover:text-primary-hover">
                  Create challan
                </Link>
              ) : null}
            </div>
            {relatedChallans.length === 0 ? (
              <EmptyState
                title="No challans for this customer"
                description="Sales challans created for this account will appear here."
              />
            ) : (
              <ul className="divide-y divide-line">
                {relatedChallans.map((challan) => (
                  <li key={challan.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link to={challanPath(challan.id)} className="font-medium text-ink hover:text-primary">
                        {challan.challanNumber}
                      </Link>
                      <p className="text-caption">
                        {challan.totalQuantity} units · {formatDate(challan.createdAt)}
                      </p>
                    </div>
                    <ChallanStatusBadge status={challan.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-section">Activity</h2>
            {canManage ? (
              <Button variant="ghost" size="sm" onClick={() => setFollowUpOpen(true)}>
                Add
              </Button>
            ) : null}
          </div>
          {followUps.length === 0 ? (
            <EmptyState
              title="No follow-ups yet"
              description="Notes added here stay as history and do not replace the current CRM note."
            />
          ) : (
            <ol className="space-y-4 border-l border-line pl-4">
              {followUps.map((item) => (
                <li key={item.id}>
                  <p className="text-sm font-medium text-ink">{item.createdBy.name}</p>
                  <p className="text-caption">{formatDateTime(item.createdAt)}</p>
                  <p className="mt-1 text-secondary">{item.note}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {editOpen ? (
        <CustomerFormModal
          open
          customer={customer}
          onClose={() => setEditOpen(false)}
          onSubmit={handleSave}
        />
      ) : null}
      {followUpOpen ? (
        <FollowUpModal open onClose={() => setFollowUpOpen(false)} onSubmit={handleFollowUp} />
      ) : null}
    </div>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-caption">{label}</dt>
      <dd className="mt-1 text-body">{value}</dd>
    </div>
  );
}
