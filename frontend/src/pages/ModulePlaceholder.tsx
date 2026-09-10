import { EmptyState } from '../components/feedback/EmptyState.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}

export function ModulePlaceholder({
  title,
  description,
  emptyTitle,
  emptyDescription,
}: ModulePlaceholderProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
