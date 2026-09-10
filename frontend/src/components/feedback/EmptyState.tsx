import type { ReactNode } from 'react';
import { EmptyIcon } from '../../assets/icons.tsx';
import { cn } from '../../utils/cn.ts';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('max-w-lg', className)}>
      <EmptyIcon className="mb-3 h-6 w-6 text-ink-muted" />
      <h2 className="text-section">{title}</h2>
      <p className="mt-1 text-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
