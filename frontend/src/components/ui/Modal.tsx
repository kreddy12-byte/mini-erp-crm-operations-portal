import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { CloseIcon } from '../../assets/icons.tsx';
import { cn } from '../../utils/cn.ts';
import { Button } from './Button.tsx';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, title, description, onClose, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;

    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 shadow-md',
        'backdrop:bg-ink/40',
        className,
      )}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id={titleId} className="text-section">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
          <CloseIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
