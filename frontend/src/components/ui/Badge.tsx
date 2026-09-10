import type { ReactNode } from 'react';
import { cn } from '../../utils/cn.ts';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-canvas text-ink-secondary',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  info: 'bg-info-muted text-info',
};

const toneLabel: Record<BadgeTone, string> = {
  neutral: 'Status',
  success: 'Success',
  warning: 'Warning',
  danger: 'Alert',
  info: 'Info',
};

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        toneClass[tone],
      )}
    >
      <span className="sr-only">{toneLabel[tone]}:</span>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
