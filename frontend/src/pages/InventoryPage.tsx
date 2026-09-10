import { ModulePlaceholder } from './ModulePlaceholder.tsx';

export function InventoryPage() {
  return (
    <ModulePlaceholder
      title="Inventory"
      description="Stock positions will live here once inventory tracking is enabled."
      emptyTitle="No inventory yet"
      emptyDescription="Stock positions will appear here once inventory tracking is enabled."
    />
  );
}
