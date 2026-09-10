import { useEffect, useState } from 'react';
import { CustomerStatusBadge } from '../customers/customerDisplay.tsx';
import { Button } from '../ui/Button.tsx';
import { SearchSelect } from './SearchSelect.tsx';
import { CUSTOMER_TYPE_LABELS } from '../../constants/customer.ts';
import { listCustomers } from '../../services/customers.ts';
import type { Customer } from '../../types/customer.ts';

interface ChallanCustomerSectionProps {
  customer: Customer | null;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
  disabled?: boolean;
  error?: string;
}

export function ChallanCustomerSection({
  customer,
  onSelect,
  onClear,
  disabled = false,
  error,
}: ChallanCustomerSectionProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || customer) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLoading(true);
      listCustomers({ page: 1, pageSize: 8, search: term, sortBy: 'name', sortOrder: 'asc' })
        .then((result) => setOptions(result.customers))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query, customer]);

  if (customer) {
    return (
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-section">Customer</h2>
          {disabled ? null : (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Change
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="font-medium text-ink">{customer.name}</p>
            <p className="text-secondary">{customer.businessName || CUSTOMER_TYPE_LABELS[customer.customerType]}</p>
            <p className="mt-1 text-caption">
              {customer.mobile}
              {customer.email ? ` · ${customer.email}` : ''}
              {` · ${CUSTOMER_TYPE_LABELS[customer.customerType]}`}
            </p>
          </div>
          <CustomerStatusBadge status={customer.status} />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-section">Customer</h2>
      <p className="mt-1 mb-3 text-secondary">Search an existing account. New customers are added from the Customers module.</p>
      <SearchSelect
        label="Find customer"
        query={query}
        onQueryChange={setQuery}
        options={options}
        loading={loading}
        disabled={disabled}
        placeholder="Type at least 2 characters"
        emptyText="No matching customers"
        error={error}
        getKey={(option) => option.id}
        getLabel={(option) => option.name}
        getDescription={(option) =>
          [option.businessName, option.mobile, CUSTOMER_TYPE_LABELS[option.customerType]].filter(Boolean).join(' · ')
        }
        onSelect={(option) => {
          onSelect(option);
          setQuery('');
        }}
      />
    </section>
  );
}
