import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn.ts';

interface DropdownItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface DropdownProps {
  label: string;
  items: DropdownItem[];
  trigger: ReactNode;
  align?: 'start' | 'end';
}

export function Dropdown({ label, items, trigger, align = 'end' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const buttonId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={buttonId}
        type="button"
        className="inline-flex items-center"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          className={cn(
            'absolute z-30 mt-2 min-w-48 rounded-md border border-line bg-surface p-1 shadow-sm',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className="flex w-full rounded-sm px-3 py-2 text-left text-sm text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-muted"
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
