import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiClientError } from '../../types/api.ts';
import type { CreateStockMovementRequest, MovementType, Product } from '../../types/product.ts';
import { resolveStockStatus } from '../../utils/stockStatus.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Modal } from '../ui/Modal.tsx';
import { Select } from '../ui/Select.tsx';
import { Textarea } from '../ui/Textarea.tsx';
import { StockStatusBadge } from '../products/productDisplay.tsx';

interface StockMovementModalProps {
  open: boolean;
  product: Product;
  onClose: () => void;
  onSubmit: (payload: CreateStockMovementRequest) => Promise<void>;
}

interface FormErrors {
  quantity?: string;
  reason?: string;
  form?: string;
}

export function StockMovementModal({ open, product, onClose, onSubmit }: StockMovementModalProps) {
  const [movementType, setMovementType] = useState<MovementType>('IN');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const parsedQuantity = Number.parseInt(quantity, 10);
  const quantityValid = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && String(parsedQuantity) === quantity.trim();
  const resultingStock = quantityValid
    ? movementType === 'IN'
      ? product.currentStock + parsedQuantity
      : product.currentStock - parsedQuantity
    : null;
  const insufficient = movementType === 'OUT' && quantityValid && parsedQuantity > product.currentStock;

  const previewStatus = useMemo(() => {
    if (resultingStock === null || resultingStock < 0) return null;
    return resolveStockStatus(resultingStock, product.minStock);
  }, [product.minStock, resultingStock]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FormErrors = {};
    if (!quantityValid) {
      nextErrors.quantity = 'Quantity must be a positive whole number.';
    } else if (insufficient) {
      nextErrors.quantity = `Insufficient stock. Only ${product.currentStock} units are available.`;
    }
    if (!reason.trim()) {
      nextErrors.reason = 'Reason is required.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        movementType,
        quantity: parsedQuantity,
        reason: reason.trim(),
      });
    } catch (caught: unknown) {
      const message =
        caught instanceof ApiClientError
          ? caught.message
          : 'Unable to record this movement. Please try again.';
      if (caught instanceof ApiClientError && caught.code === 'INSUFFICIENT_STOCK') {
        setErrors({ quantity: message, form: message });
      } else {
        setErrors({ form: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Adjust stock"
      description={`${product.name} · ${product.sku}`}
      onClose={submitting ? () => undefined : onClose}
      className="w-[min(36rem,calc(100vw-2rem))]"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-canvas px-3 py-2">
          <div>
            <p className="text-caption">Current stock</p>
            <p className="text-section">{product.currentStock}</p>
          </div>
          <StockStatusBadge status={product.stockStatus} />
        </div>

        <Select
          label="Movement type"
          name="movementType"
          value={movementType}
          onChange={(event) => setMovementType(event.target.value as MovementType)}
          disabled={submitting}
          hint={
            movementType === 'IN'
              ? 'IN increases on-hand stock.'
              : 'OUT issues stock and cannot exceed the current quantity.'
          }
          options={[
            { value: 'IN', label: 'IN — receive into stock' },
            { value: 'OUT', label: 'OUT — issue from stock' },
          ]}
        />
        <Input
          label="Quantity"
          name="quantity"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={errors.quantity}
          disabled={submitting}
          required
        />
        <Textarea
          label="Reason"
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={errors.reason}
          disabled={submitting}
          rows={3}
          required
        />

        {resultingStock !== null ? (
          <p className="text-secondary" aria-live="polite">
            {insufficient ? (
              <>Insufficient stock. Only {product.currentStock} units are available.</>
            ) : (
              <>
                Resulting stock: {resultingStock}
                {previewStatus ? ` · ${previewStatus === 'HEALTHY' ? 'Healthy' : previewStatus === 'LOW' ? 'Low stock' : 'Out of stock'}` : ''}
              </>
            )}
          </p>
        ) : null}

        {errors.form ? (
          <p className="text-sm text-danger" role="alert">
            {errors.form}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={movementType === 'OUT' ? 'danger' : 'primary'}
            loading={submitting}
            disabled={submitting || insufficient}
          >
            {movementType === 'IN' ? 'Record stock in' : 'Record stock out'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
