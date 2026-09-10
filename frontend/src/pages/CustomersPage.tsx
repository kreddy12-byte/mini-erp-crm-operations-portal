import { ModulePlaceholder } from './ModulePlaceholder.tsx';

export function CustomersPage() {
  return (
    <ModulePlaceholder
      title="Customers"
      description="Customer records and relationship context will live here."
      emptyTitle="No customers yet"
      emptyDescription="Add your first customer to start managing your CRM pipeline."
    />
  );
}
