import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn.ts';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-primary/50',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-canvas disabled:text-ink-muted',
  ghost: 'bg-transparent text-ink hover:bg-canvas disabled:text-ink-muted',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-3.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-70',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="sr-only">Loading</span> : null}
      {children}
    </button>
  );
}
