import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn.ts';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md';
}

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
} as const;

export function Card({ children, className, padding = 'md', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface shadow-xs',
        paddingClass[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
