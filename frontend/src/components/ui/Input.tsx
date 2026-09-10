import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn.ts';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  hideLabel?: boolean;
}

export function Input({
  label,
  hint,
  error,
  hideLabel = false,
  id,
  className,
  disabled,
  ...props
}: InputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          'text-sm font-medium text-ink',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>
      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted',
          'transition-colors disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted',
          error ? 'border-danger' : 'border-line-strong hover:border-ink-muted',
          className,
        )}
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-caption">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
