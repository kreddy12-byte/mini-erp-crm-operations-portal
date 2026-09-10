import { Button } from './Button.tsx';

export interface PaginationMetaView {
  page: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function PaginationBar({
  pagination,
  noun,
  onPage,
}: {
  pagination: PaginationMetaView;
  noun: string;
  onPage: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-caption">
        {pagination.total} {noun}
        {pagination.totalPages ? ` · page ${pagination.page} of ${pagination.totalPages}` : ''}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasPrevious}
          onClick={() => onPage(pagination.page - 1)}
        >
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={!pagination.hasNext} onClick={() => onPage(pagination.page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
