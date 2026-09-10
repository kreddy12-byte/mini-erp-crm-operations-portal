import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChallanForm } from '../components/challans/ChallanForm.tsx';
import type { ChallanLineDraft } from '../components/challans/ChallanProductTable.tsx';
import { describeChallanError } from '../components/challans/challanErrors.ts';
import { ErrorState } from '../components/feedback/ErrorState.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { PageSkeleton } from '../components/ui/Skeleton.tsx';
import { canManageChallans } from '../constants/challan.ts';
import { challanPath, paths } from '../constants/navigation.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { getChallan } from '../services/challans.ts';
import { getCustomer } from '../services/customers.ts';
import { getProduct } from '../services/products.ts';
import type { Challan } from '../types/challan.ts';
import type { Customer } from '../types/customer.ts';

export function ChallanEditorPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <CreateChallanScreen />;
  }
  return <EditChallanScreen id={id} />;
}

function CreateChallanScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<ChallanLineDraft[]>([]);
  const canManage = canManageChallans(user?.role);

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Create challan" description="Draft a delivery against current stock." />
        <p className="mb-4">
          <Link to={paths.challans} className="text-sm font-medium text-primary hover:text-primary-hover">
            Back to challans
          </Link>
        </p>
        <ErrorState
          title="You don't have permission to perform this action."
          description="Creating challans is limited to Admin and Sales roles."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Create challan"
        description="Select a customer, add products, then save a draft or confirm against live stock."
      />
      <ChallanForm
        customer={customer}
        lines={lines}
        onCustomerChange={setCustomer}
        onLinesChange={setLines}
        onCancel={() => navigate(paths.challans)}
        onDraftSaved={(challan) => {
          pushToast({ title: 'Draft saved', description: `${challan.challanNumber} can still be edited.`, tone: 'success' });
          navigate(challanPath(challan.id), { replace: true });
        }}
        onConfirmed={(challan) => {
          pushToast({
            title: 'Challan confirmed',
            description: 'Stock was deducted and movements were recorded.',
            tone: 'success',
          });
          navigate(challanPath(challan.id), { replace: true });
        }}
        onConfirmFailed={(challan) => {
          navigate(`${challanPath(challan.id)}?edit=1`, { replace: true });
        }}
        onError={(title, description) => pushToast({ title, description, tone: 'danger' })}
      />
    </div>
  );
}

function EditChallanScreen({ id }: { id: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [challan, setChallan] = useState<Challan | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<ChallanLineDraft[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const canManage = canManageChallans(user?.role);

  useEffect(() => {
    let cancelled = false;

    getChallan(id)
      .then(async (record) => {
        if (record.status !== 'DRAFT') {
          navigate(challanPath(record.id), { replace: true });
          return;
        }
        const [customerRecord, products] = await Promise.all([
          getCustomer(record.customer.id).catch(() => null),
          Promise.all(
            record.items.map((item) =>
              getProduct(item.productId).catch(
                (): import('../types/product.ts').Product => ({
                  id: item.productId,
                  name: item.productNameSnapshot,
                  sku: item.skuSnapshot,
                  category: '',
                  unitPrice: item.unitPriceSnapshot,
                  currentStock: 0,
                  minStock: 0,
                  location: '',
                  stockStatus: 'CRITICAL',
                  createdAt: item.createdAt,
                  updatedAt: item.createdAt,
                }),
              ),
            ),
          ),
        ]);
        if (cancelled) return;
        setChallan(record);
        setCustomer(
          customerRecord ?? {
            ...record.customer,
            gstNumber: null,
            address: '',
            followUpDate: null,
            notes: null,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            latestFollowUpAt: null,
          },
        );
        setLines(
          record.items.map((item, index) => ({
            product: products[index],
            quantity: item.quantity,
          })),
        );
        setStatus('success');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const copy = describeChallanError(reason, 'Unable to load challan');
        setError(copy.description);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id, navigate, retryKey]);

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Edit challan" description="Drafts can be changed until they are confirmed." />
        <ErrorState
          title="You don't have permission to perform this action."
          description="Editing challans is limited to Admin and Sales roles."
        />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div>
        <PageHeader title="Edit challan" description="Loading draft." />
        <PageSkeleton />
      </div>
    );
  }

  if (status === 'error' || !challan) {
    return (
      <div>
        <PageHeader title="Edit challan" description="This draft could not be opened." />
        <p className="mb-4">
          <Link to={paths.challans} className="text-sm font-medium text-primary hover:text-primary-hover">
            Back to challans
          </Link>
        </p>
        <ErrorState
          title="Unable to load challan"
          description={error ?? 'This draft could not be loaded.'}
          onRetry={() => setRetryKey((value) => value + 1)}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={challan.challanNumber}
        description="Drafts do not deduct stock. Saving refreshes product snapshots from the current catalog."
      />
      <ChallanForm
        existing={challan}
        customer={customer}
        lines={lines}
        onCustomerChange={setCustomer}
        onLinesChange={setLines}
        onCancel={() => navigate(challanPath(challan.id))}
        onDraftSaved={(saved) => {
          pushToast({ title: 'Draft updated', tone: 'success' });
          setChallan(saved);
          navigate(challanPath(saved.id), { replace: true });
        }}
        onConfirmed={(saved) => {
          pushToast({
            title: 'Challan confirmed',
            description: 'Stock was deducted and movements were recorded.',
            tone: 'success',
          });
          navigate(challanPath(saved.id), { replace: true });
        }}
        onConfirmFailed={(saved) => {
          setChallan(saved);
        }}
        onError={(title, description) => pushToast({ title, description, tone: 'danger' })}
      />
    </div>
  );
}
