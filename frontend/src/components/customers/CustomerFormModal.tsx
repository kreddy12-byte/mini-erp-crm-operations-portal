import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiClientError } from '../../types/api.ts';
import type { Customer, CustomerStatus, CustomerType, CustomerWritePayload } from '../../types/customer.ts';
import { toDateInputValue } from '../../utils/dates.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Modal } from '../ui/Modal.tsx';
import { Select } from '../ui/Select.tsx';
import { Textarea } from '../ui/Textarea.tsx';

interface CustomerFormModalProps {
  open: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSubmit: (payload: CustomerWritePayload) => Promise<void>;
}

interface FormState {
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber: string;
  customerType: CustomerType | '';
  address: string;
  status: CustomerStatus | '';
  followUpDate: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  mobile?: string;
  email?: string;
  customerType?: string;
  status?: string;
  form?: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  mobile: '',
  email: '',
  businessName: '',
  gstNumber: '',
  customerType: '',
  address: '',
  status: '',
  followUpDate: '',
  notes: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function customerToForm(customer: Customer): FormState {
  return {
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email ?? '',
    businessName: customer.businessName,
    gstNumber: customer.gstNumber ?? '',
    customerType: customer.customerType,
    address: customer.address,
    status: customer.status,
    followUpDate: toDateInputValue(customer.followUpDate),
    notes: customer.notes ?? '',
  };
}

export function CustomerFormModal({ open, customer, onClose, onSubmit }: CustomerFormModalProps) {
  const [form, setForm] = useState<FormState>(customer ? customerToForm(customer) : EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(customer);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (!/^\+?[0-9]{8,15}$/.test(form.mobile.replace(/[\s-]/g, ''))) {
      nextErrors.mobile = 'Enter a valid mobile number.';
    }
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.customerType) nextErrors.customerType = 'Customer type is required.';
    if (!form.status) nextErrors.status = 'Status is required.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: CustomerWritePayload = {
      name: form.name.trim(),
      mobile: form.mobile.replace(/[\s-]/g, ''),
      customerType: form.customerType as CustomerType,
      status: form.status as CustomerStatus,
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.businessName.trim()) payload.businessName = form.businessName.trim();
    if (form.gstNumber.trim()) payload.gstNumber = form.gstNumber.trim();
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.followUpDate) payload.followUpDate = form.followUpDate;
    if (form.notes.trim()) payload.notes = form.notes.trim();

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (reason: unknown) {
      setErrors({
        form:
          reason instanceof ApiClientError
            ? reason.message
            : 'Unable to save this customer. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit customer' : 'Add customer'}
      description="Contact and CRM fields used by sales follow-up."
      onClose={submitting ? () => undefined : onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
    >
      <form onSubmit={handleSubmit} className="max-h-[min(32rem,70vh)] space-y-6 overflow-y-auto pr-1" noValidate>
        <fieldset className="space-y-3">
          <legend className="text-caption">Contact</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Name"
              name="name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              error={errors.name}
              disabled={submitting}
              autoComplete="name"
              required
            />
            <Input
              label="Mobile"
              name="mobile"
              value={form.mobile}
              onChange={(event) => update('mobile', event.target.value)}
              error={errors.mobile}
              disabled={submitting}
              autoComplete="tel"
              required
            />
          </div>
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            error={errors.email}
            disabled={submitting}
            autoComplete="email"
          />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-caption">Business</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Business name"
              name="businessName"
              value={form.businessName}
              onChange={(event) => update('businessName', event.target.value)}
              disabled={submitting}
            />
            <Input
              label="GST number"
              name="gstNumber"
              value={form.gstNumber}
              onChange={(event) => update('gstNumber', event.target.value)}
              disabled={submitting}
              hint="Optional"
            />
          </div>
          <Select
            label="Customer type"
            name="customerType"
            value={form.customerType}
            onChange={(event) => update('customerType', event.target.value as CustomerType | '')}
            error={errors.customerType}
            disabled={submitting}
            placeholder="Select type"
            options={[
              { value: 'RETAIL', label: 'Retail' },
              { value: 'WHOLESALE', label: 'Wholesale' },
              { value: 'DISTRIBUTOR', label: 'Distributor' },
            ]}
          />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-caption">CRM</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Status"
              name="status"
              value={form.status}
              onChange={(event) => update('status', event.target.value as CustomerStatus | '')}
              error={errors.status}
              disabled={submitting}
              placeholder="Select status"
              options={[
                { value: 'LEAD', label: 'Lead' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
            <Input
              label="Follow-up date"
              name="followUpDate"
              type="date"
              value={form.followUpDate}
              onChange={(event) => update('followUpDate', event.target.value)}
              disabled={submitting}
            />
          </div>
          <Textarea
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            disabled={submitting}
            rows={3}
          />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-caption">Address</legend>
          <Textarea
            label="Address"
            name="address"
            value={form.address}
            onChange={(event) => update('address', event.target.value)}
            disabled={submitting}
            rows={2}
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
            {isEdit ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
