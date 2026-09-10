import { useEffect, useMemo, useState } from 'react';
import { ChallanConfirmModal } from './ChallanConfirmModal.tsx';
import { ChallanCustomerSection } from './ChallanCustomerSection.tsx';
import { ChallanProductTable, type ChallanLineDraft } from './ChallanProductTable.tsx';
import { ChallanSummary } from './ChallanSummary.tsx';
import { challanLineQuantityError, describeChallanError } from './challanErrors.ts';
import { Button } from '../ui/Button.tsx';
import { confirmChallan, createChallan, updateChallan } from '../../services/challans.ts';
import { listProducts } from '../../services/products.ts';
import type { Challan } from '../../types/challan.ts';
import type { Customer } from '../../types/customer.ts';
import type { Product } from '../../types/product.ts';

interface ChallanFormProps {
  customer: Customer | null;
  lines: ChallanLineDraft[];
  existing?: Challan | null;
  busy?: boolean;
  onCustomerChange: (customer: Customer | null) => void;
  onLinesChange: (lines: ChallanLineDraft[]) => void;
  onCancel: () => void;
  onDraftSaved: (challan: Challan) => void;
  onConfirmed: (challan: Challan) => void;
  onConfirmFailed?: (challan: Challan) => void;
  onError: (title: string, description: string) => void;
}

export function ChallanForm({
  customer,
  lines,
  existing = null,
  busy = false,
  onCustomerChange,
  onLinesChange,
  onCancel,
  onDraftSaved,
  onConfirmed,
  onConfirmFailed,
  onError,
}: ChallanFormProps) {
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | undefined>();
  const [customerError, setCustomerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState<'draft' | 'confirm' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const term = productQuery.trim();
    if (term.length < 2) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setProductLoading(true);
      listProducts({ page: 1, pageSize: 8, search: term, sortBy: 'name', sortOrder: 'asc' })
        .then((result) => setProductOptions(result.products))
        .catch(() => setProductOptions([]))
        .finally(() => setProductLoading(false));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [productQuery]);

  const invalidLines = useMemo(
    () => lines.filter((line) => Boolean(challanLineQuantityError(line.quantity, line.product.currentStock))),
    [lines],
  );
  const stockBlocked = lines.some((line) => line.quantity > line.product.currentStock);
  const canSaveDraft =
    Boolean(customer) &&
    lines.length > 0 &&
    lines.every((line) => Number.isInteger(line.quantity) && line.quantity >= 1);
  const canConfirm = canSaveDraft && !stockBlocked;

  function handleAddProduct(product: Product) {
    if (lines.some((line) => line.product.id === product.id)) {
      setDuplicateError('That product is already on this challan. Update the existing quantity instead.');
      return;
    }
    setDuplicateError(undefined);
    setProductQuery('');
    onLinesChange([...lines, { product, quantity: 1 }]);
  }

  function payload() {
    if (!customer) return null;
    return {
      customerId: customer.id,
      items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    };
  }

  async function persistDraft(): Promise<Challan | null> {
    const body = payload();
    if (!body) {
      setCustomerError('Select a customer before saving.');
      return null;
    }
    setCustomerError(undefined);
    // Draft writes never deduct stock. Confirmation is a separate server transaction.
    if (existing) {
      return updateChallan(existing.id, body);
    }
    return createChallan(body);
  }

  async function handleSaveDraft() {
    if (!canSaveDraft || submitting) return;
    setSubmitting('draft');
    try {
      const saved = await persistDraft();
      if (saved) onDraftSaved(saved);
    } catch (error: unknown) {
      const copy = describeChallanError(error, 'Unable to save draft');
      onError(copy.title, copy.description);
    } finally {
      setSubmitting(null);
    }
  }

  async function handleConfirm() {
    if (!canConfirm || submitting) return;
    setSubmitting('confirm');
    try {
      // 1. CREATE OR UPDATE DRAFT so a failed confirm still leaves an editable challan.
      const draft = await persistDraft();
      if (!draft) return;
      try {
        // 2. CONFIRM ON SERVER — stock locks, deductions, and OUT movements happen there.
        const confirmed = await confirmChallan(draft.id);
        setConfirmOpen(false);
        onConfirmed(confirmed);
      } catch (error: unknown) {
        // 3. HANDLE ATOMIC STOCK FAILURE without discarding the draft the user just saved.
        const copy = describeChallanError(error, 'Unable to confirm challan');
        setConfirmOpen(false);
        if (onConfirmFailed) onConfirmFailed(draft);
        else onDraftSaved(draft);
        onError(copy.title, copy.description);
      }
    } catch (error: unknown) {
      const copy = describeChallanError(error, 'Unable to save draft before confirmation');
      onError(copy.title, copy.description);
    } finally {
      setSubmitting(null);
    }
  }

  const locked = busy || submitting !== null;

  return (
    <div className="space-y-8">
      <ChallanCustomerSection
        customer={customer}
        disabled={locked}
        error={customerError}
        onSelect={(next) => {
          setCustomerError(undefined);
          onCustomerChange(next);
        }}
        onClear={() => onCustomerChange(null)}
      />

      <ChallanProductTable
        lines={lines}
        productQuery={productQuery}
        productOptions={productOptions}
        productLoading={productLoading}
        disabled={locked}
        duplicateError={duplicateError}
        onProductQueryChange={(value) => {
          setDuplicateError(undefined);
          setProductQuery(value);
        }}
        onAddProduct={handleAddProduct}
        onQuantityChange={(productId, quantity) => {
          onLinesChange(
            lines.map((line) => (line.product.id === productId ? { ...line, quantity } : line)),
          );
        }}
        onRemove={(productId) => onLinesChange(lines.filter((line) => line.product.id !== productId))}
      />

      <ChallanSummary customerName={customer?.name} lines={lines} />

      {invalidLines.length > 0 ? (
        <p className="text-sm text-danger" role="alert">
          {stockBlocked
            ? 'Requested quantity exceeds available stock on one or more lines. Save as draft is still allowed; confirmation is blocked until quantities fit current stock.'
            : 'Correct invalid quantities before saving.'}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={locked} onClick={onCancel}>
          Back
        </Button>
        <Button variant="secondary" loading={submitting === 'draft'} disabled={!canSaveDraft || locked} onClick={handleSaveDraft}>
          Save draft
        </Button>
        <Button disabled={!canConfirm || locked} onClick={() => setConfirmOpen(true)}>
          Confirm challan
        </Button>
      </div>

      <ChallanConfirmModal
        open={confirmOpen}
        loading={submitting === 'confirm'}
        challanNumber={existing?.challanNumber}
        onClose={() => {
          if (submitting === 'confirm') return;
          setConfirmOpen(false);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
