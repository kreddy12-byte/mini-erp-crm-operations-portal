import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Input } from '../ui/Input.tsx';

interface SearchSelectProps<T> {
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: T[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  hint?: ReactNode;
  error?: string;
  getKey: (option: T) => string;
  getLabel: (option: T) => string;
  getDescription?: (option: T) => string | undefined;
  onSelect: (option: T) => void;
}

export function SearchSelect<T>({
  label,
  query,
  onQueryChange,
  options,
  loading = false,
  disabled = false,
  placeholder,
  emptyText = 'No matches',
  hint,
  error,
  getKey,
  getLabel,
  getDescription,
  onSelect,
}: SearchSelectProps<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const showList = open && query.trim().length > 0;

  return (
    <div className="relative">
      <Input
        label={label}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        hint={hint}
        error={error}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-sm"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-ink-muted">Searching…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{emptyText}</li>
          ) : (
            options.map((option) => (
              <li key={getKey(option)} role="option">
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-canvas"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <span className="text-sm font-medium text-ink">{getLabel(option)}</span>
                  {getDescription?.(option) ? (
                    <span className="text-caption">{getDescription(option)}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
