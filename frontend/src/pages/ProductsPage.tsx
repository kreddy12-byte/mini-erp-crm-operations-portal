import { ModulePlaceholder } from './ModulePlaceholder.tsx';

export function ProductsPage() {
  return (
    <ModulePlaceholder
      title="Products"
      description="Catalog records will live here once product management is enabled."
      emptyTitle="No products yet"
      emptyDescription="Add your first product to start building the sales catalog."
    />
  );
}
