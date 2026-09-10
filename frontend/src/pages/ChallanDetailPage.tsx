import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChallanCancelModal } from '../components/challans/ChallanCancelModal.tsx';
import { ChallanConfirmModal } from '../components/challans/ChallanConfirmModal.tsx';
import { ChallanStatusBadge } from '../components/challans/ChallanStatusBadge.tsx';
import { describeChallanError } from '../components/challans/challanErrors.ts';
import { CustomerStatusBadge } from '../components/customers/customerDisplay.tsx';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PageSkeleton } from '../components/ui/Skeleton.tsx';
import { canManageChallans, canViewCustomersForChallans } from '../constants/challan.ts';
import { CUSTOMER_TYPE_LABELS } from '../constants/customer.ts';
import { formatUnitPrice } from '../constants/product.ts';
import { paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { cancelChallan, confirmChallan, getChallan } from '../services/challans.ts';
import { getCustomer } from '../services/customers.ts';
import { ApiClientError } from '../types/api.ts';
import type { Challan } from '../types/challan.ts';
import type { Customer } from '../types/customer.ts';
import { formatDateTime } from '../utils/dates.ts';
import { ChallanEditorPage } from './ChallanEditorPage.tsx';

export function ChallanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [retryKey, setRetryKey] = useState(0);

  if (!id) {
    return (
      <div>
        <PageHeader title="Challan" description="This record could not be opened." />
        <ErrorState title="Challan not found." description="The challan id is missing." />
      </div>
    );
  }

  if (searchParams.get('edit') === '1') {
    return <ChallanEditorPage key={`${id}-${retryKey}`} />;
  }

  return <ChallanDetailRecord key={`${id}-${retryKey}`} id={id} onRetry={() => setRetryKey((value) => value + 1)} />;
}

function ChallanDetailRecord({ id, onRetry }: { id: string; onRetry: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [challan, setChallan] = useState<Challan | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const canManage = canManageChallans(user?.role);
  const canLoadCustomer = canViewCustomersForChallans(user?.role);

  useEffect(() => {
    let cancelled = false;

    getChallan(id)
      .then(async (record) => {
        let extra: Customer | null = null;
        if (canLoadCustomer) {
          extra = await getCustomer(record.customer.id).catch(() => null);
        }
        if (cancelled) return;
        setChallan(record);
        setCustomer(extra);
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setNotFound(reason instanceof ApiClientError && reason.status === 404);
        setForbidden(reason instanceof ApiClientError && reason.status === 403);
        const copy = describeChallanError(reason, 'Unable to load challan');
        setError(copy.description);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id, canLoadCustomer]);

  async function handleConfirm() {
    if (!challan || actionLoading) return;
    setActionLoading(true);
    try {
      const confirmed = await confirmChallan(challan.id);
      setChallan(confirmed);
      setConfirmOpen(false);
      pushToast({
        title: 'Challan confirmed',
        description: 'Stock was deducted and movements were recorded.',
        tone: 'success',
      });
    } catch (reason: unknown) {
      const copy = describeChallanError(reason, 'Unable to confirm challan');
      pushToast({ title: copy.title, description: copy.description, tone: 'danger' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!challan || actionLoading) return;
    setActionLoading(true);
    try {
      const cancelled = await cancelChallan(challan.id);
      setChallan(cancelled);
      setCancelOpen(false);
      pushToast({ title: 'Draft cancelled', tone: 'success' });
    } catch (reason: unknown) {
      const copy = describeChallanError(reason, 'Unable to cancel challan');
      pushToast({ title: copy.title, description: copy.description, tone: 'danger' });
    } finally {
      setActionLoading(false);
    }
  }

  if (status === 'loading') {
    return (
      <div>
        <PageHeader title="Challan" description="Loading record." />
        <PageSkeleton />
      </div>
    );
  }

  if (status === 'error' || !challan) {
    return (
      <div>
        <PageHeader title="Challan" description="This record could not be opened." />
        <p className="mb-4">
          <Link to={paths.challans} className="text-sm font-medium text-primary hover:text-primary-hover">
            Back to challans
          </Link>
        </p>
        <ErrorState
          title={
            forbidden
              ? "You don't have permission to perform this action."
              : notFound
                ? 'Challan not found.'
                : 'Unable to load challan'
          }
          description={error ?? 'This challan could not be loaded.'}
          onRetry={notFound || forbidden ? undefined : onRetry}
        />
      </div>
    );
  }

  const snapshotNote =
    challan.status === 'CONFIRMED'
      ? 'Line names, SKUs, and prices are the values stored when this challan was last saved as a draft, then confirmed. Later catalog edits do not rewrite them.'
      : challan.status === 'CANCELLED'
        ? 'This cancelled challan keeps the product snapshots from its last draft save. Stock was never deducted.'
        : 'Draft snapshots refresh from the current catalog when you save. Confirmation still re-checks live stock on the server.';

  const estimatedValue = challan.items.reduce((sum, item) => {
    const price = Number.parseFloat(item.unitPriceSnapshot);
    return Number.isFinite(price) ? sum + price * item.quantity : sum;
  }, 0);

  return (
    <div>
      <PageHeader
        title={challan.challanNumber}
        description={`${challan.customer.name}${challan.customer.businessName ? ` · ${challan.customer.businessName}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(paths.challans)}>
              Back to list
            </Button>
            {canManage && challan.status === 'DRAFT' ? (
              <>
                <Button variant="secondary" onClick={() => navigate(`${paths.challans}/${challan.id}?edit=1`)}>
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                  Cancel draft
                </Button>
                <Button onClick={() => setConfirmOpen(true)}>Confirm</Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ChallanStatusBadge status={challan.status} />
        <span className="text-secondary">
          {challan.createdBy.name} · {formatDateTime(challan.createdAt)}
        </span>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="text-section">Customer</h2>
            <div className="mt-3 mb-3">
              <CustomerStatusBadge status={challan.customer.status} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Info label="Name" value={challan.customer.name} />
              <Info label="Business" value={challan.customer.businessName || '—'} />
              <Info label="Mobile" value={challan.customer.mobile} />
              <Info label="Email" value={challan.customer.email || '—'} />
              <Info label="Type" value={CUSTOMER_TYPE_LABELS[challan.customer.customerType]} />
              <Info label="GST" value={customer?.gstNumber || '—'} />
              <Info label="Address" value={customer?.address || '—'} className="sm:col-span-2" />
            </dl>
            {!customer && canLoadCustomer ? (
              <p className="mt-2 text-caption">Additional customer fields were not available for this record.</p>
            ) : null}
            {!canLoadCustomer ? (
              <p className="mt-2 text-caption">GST and address are shown when your role can open customer records.</p>
            ) : null}
          </section>

          <section>
            <h2 className="text-section">Items</h2>
            <p className="mt-1 mb-3 text-secondary">{snapshotNote}</p>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-caption">
                    <th className="py-2 pr-4 font-medium">Product</th>
                    <th className="py-2 pr-4 font-medium">SKU</th>
                    <th className="py-2 pr-4 font-medium">Unit price</th>
                    <th className="py-2 pr-4 font-medium">Qty</th>
                    <th className="py-2 font-medium">Line estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {challan.items.map((item) => {
                    const price = Number.parseFloat(item.unitPriceSnapshot);
                    const lineValue = Number.isFinite(price) ? price * item.quantity : null;
                    return (
                      <tr key={item.id} className="border-b border-line last:border-b-0">
                        <td className="py-3 pr-4 font-medium text-ink">{item.productNameSnapshot}</td>
                        <td className="py-3 pr-4 text-secondary">{item.skuSnapshot}</td>
                        <td className="py-3 pr-4 text-secondary">{formatUnitPrice(item.unitPriceSnapshot)}</td>
                        <td className="py-3 pr-4 text-ink">{item.quantity}</td>
                        <td className="py-3 text-secondary">{lineValue === null ? '—' : formatUnitPrice(lineValue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="space-y-3 md:hidden">
              {challan.items.map((item) => {
                const price = Number.parseFloat(item.unitPriceSnapshot);
                const lineValue = Number.isFinite(price) ? price * item.quantity : null;
                return (
                  <li key={item.id} className="border-b border-line pb-3">
                    <p className="font-medium text-ink">{item.productNameSnapshot}</p>
                    <p className="text-caption">
                      {item.skuSnapshot} · {formatUnitPrice(item.unitPriceSnapshot)} · qty {item.quantity}
                    </p>
                    <p className="mt-1 text-secondary">
                      Line estimate: {lineValue === null ? '—' : formatUnitPrice(lineValue)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="text-section">Summary</h2>
            <dl className="mt-3 space-y-3">
              <Info label="Status" value={challan.status === 'DRAFT' ? 'Draft' : challan.status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'} />
              <Info label="Product lines" value={String(challan.items.length)} />
              <Info label="Total quantity" value={String(challan.totalQuantity)} />
              <Info label="Estimated value" value={formatUnitPrice(estimatedValue)} />
              <Info label="Created by" value={`${challan.createdBy.name} (${challan.createdBy.role})`} />
              <Info label="Created" value={formatDateTime(challan.createdAt)} />
            </dl>
            <p className="mt-3 text-caption">
              Estimated value is calculated in the browser from snapshot unit prices. The API does not store a challan
              monetary total.
            </p>
          </section>
        </aside>
      </div>

      <ChallanConfirmModal
        open={confirmOpen}
        loading={actionLoading}
        challanNumber={challan.challanNumber}
        onClose={() => {
          if (actionLoading) return;
          setConfirmOpen(false);
        }}
        onConfirm={handleConfirm}
      />
      <ChallanCancelModal
        open={cancelOpen}
        loading={actionLoading}
        challanNumber={challan.challanNumber}
        onClose={() => {
          if (actionLoading) return;
          setCancelOpen(false);
        }}
        onConfirm={handleCancel}
      />
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
