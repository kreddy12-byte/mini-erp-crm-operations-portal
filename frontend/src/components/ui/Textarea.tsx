import type { TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn.ts';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function Textarea({
  label,
  hint,
  error,
  id,
  className,
  disabled,
  rows = 4,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const required = Boolean(props.required);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted',
          'transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted',
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
