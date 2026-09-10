import type { SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDownIcon } from '../../assets/icons.tsx';
import { cn } from '../../utils/cn.ts';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string;
  options: SelectOption[];
  hint?: ReactNode;
  error?: string;
  placeholder?: string;
}

export function Select({
  label,
  options,
  hint,
  error,
  placeholder,
  id,
  className,
  disabled,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={cn(
            'h-10 w-full appearance-none rounded-md border bg-surface py-0 pl-3 pr-10 text-sm text-ink',
            'transition-colors disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted',
            error ? 'border-danger' : 'border-line-strong hover:border-ink-muted',
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      </div>
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
