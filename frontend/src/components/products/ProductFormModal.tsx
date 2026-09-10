import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiClientError } from '../../types/api.ts';
import type { CreateProductRequest, Product, UpdateProductRequest } from '../../types/product.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Modal } from '../ui/Modal.tsx';

interface ProductFormModalProps {
  open: boolean;
  product?: Product | null;
  categories?: string[];
  onClose: () => void;
  onSubmit: (payload: CreateProductRequest | UpdateProductRequest) => Promise<void>;
}

interface FormState {
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: string;
  minStock: string;
  location: string;
}

interface FormErrors {
  name?: string;
  sku?: string;
  category?: string;
  unitPrice?: string;
  currentStock?: string;
  minStock?: string;
  location?: string;
  form?: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  category: '',
  unitPrice: '',
  currentStock: '0',
  minStock: '0',
  location: '',
};

function productToForm(product: Product): FormState {
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    unitPrice: product.unitPrice,
    currentStock: String(product.currentStock),
    minStock: String(product.minStock),
    location: product.location,
  };
}

function parseNonNegativeInt(value: string, field: string): { value?: number; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: `${field} is required.` };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== trimmed) {
    return { error: `${field} must be a whole number of 0 or more.` };
  }
  return { value: parsed };
}

export function ProductFormModal({
  open,
  product,
  categories = [],
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [form, setForm] = useState<FormState>(product ? productToForm(product) : EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(product);
  const categoryListId = 'product-category-suggestions';

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Product name is required.';
    if (!form.sku.trim()) nextErrors.sku = 'SKU is required.';
    if (!form.category.trim()) nextErrors.category = 'Category is required.';
    if (!form.location.trim()) nextErrors.location = 'Location is required.';

    const price = Number.parseFloat(form.unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      nextErrors.unitPrice = 'Unit price must be 0 or more.';
    }

    const minStock = parseNonNegativeInt(form.minStock, 'Minimum stock');
    if (minStock.error) nextErrors.minStock = minStock.error;

    let currentStock: number | undefined;
    if (!isEdit) {
      const parsedStock = parseNonNegativeInt(form.currentStock, 'Initial stock');
      if (parsedStock.error) nextErrors.currentStock = parsedStock.error;
      currentStock = parsedStock.value;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || minStock.value === undefined) {
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await onSubmit({
          name: form.name.trim(),
          sku: form.sku.trim(),
          category: form.category.trim(),
          unitPrice: price.toFixed(2),
          minStock: minStock.value,
          location: form.location.trim(),
        });
      } else {
        await onSubmit({
          name: form.name.trim(),
          sku: form.sku.trim(),
          category: form.category.trim(),
          unitPrice: price.toFixed(2),
          currentStock: currentStock ?? 0,
          minStock: minStock.value,
          location: form.location.trim(),
        });
      }
    } catch (reason: unknown) {
      const message =
        reason instanceof ApiClientError
          ? reason.message
          : 'Unable to save this product. Please try again.';
      if (reason instanceof ApiClientError && reason.code === 'DUPLICATE_SKU') {
        setErrors({ sku: message, form: message });
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
      title={isEdit ? 'Edit product' : 'Add product'}
      description={
        isEdit
          ? 'Catalog details only. Change on-hand quantity with a stock movement.'
          : 'Create a catalog item. Initial stock greater than zero is recorded as an opening IN movement.'
      }
      onClose={submitting ? () => undefined : onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
    >
      <form onSubmit={handleSubmit} className="max-h-[min(32rem,70vh)] space-y-6 overflow-y-auto pr-1" noValidate>
        <fieldset className="space-y-3">
          <legend className="text-caption">Product</legend>
          <Input
            label="Product name"
            name="name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            error={errors.name}
            disabled={submitting}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="SKU"
              name="sku"
              value={form.sku}
              onChange={(event) => update('sku', event.target.value)}
              error={errors.sku}
              disabled={submitting}
              required
            />
            <Input
              label="Category"
              name="category"
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
              error={errors.category}
              disabled={submitting}
              list={categoryListId}
              required
            />
          </div>
          <datalist id={categoryListId}>
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-caption">Pricing</legend>
          <Input
            label="Unit price"
            name="unitPrice"
            inputMode="decimal"
            value={form.unitPrice}
            onChange={(event) => update('unitPrice', event.target.value)}
            error={errors.unitPrice}
            disabled={submitting}
            required
          />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-caption">Inventory</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {isEdit ? (
              <Input
                label="Current stock"
                name="currentStock"
                value={form.currentStock}
                disabled
                hint="Adjust stock from Inventory."
              />
            ) : (
              <Input
                label="Initial stock"
                name="currentStock"
                inputMode="numeric"
                value={form.currentStock}
                onChange={(event) => update('currentStock', event.target.value)}
                error={errors.currentStock}
                disabled={submitting}
                required
              />
            )}
            <Input
              label="Minimum stock alert"
              name="minStock"
              inputMode="numeric"
              value={form.minStock}
              onChange={(event) => update('minStock', event.target.value)}
              error={errors.minStock}
              disabled={submitting}
              required
            />
          </div>
          <Input
            label="Location"
            name="location"
            value={form.location}
            onChange={(event) => update('location', event.target.value)}
            error={errors.location}
            disabled={submitting}
            required
          />
        </fieldset>

        {errors.form ? (
          <p className="text-sm text-danger" role="alert">
            {errors.form}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            {isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
