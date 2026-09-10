import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext, type ToastInput, type ToastTone } from '../../hooks/useToast.ts';
import { cn } from '../../utils/cn.ts';

interface ToastItem extends ToastInput {
  id: string;
}

const toneClass: Record<ToastTone, string> = {
  success: 'border-success/30',
  warning: 'border-warning/30',
  danger: 'border-danger/30',
  info: 'border-info/30',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => {
          const tone = toast.tone ?? 'info';
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto rounded-md border bg-surface px-3 py-2.5 shadow-sm',
                toneClass[tone],
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-0.5 text-secondary">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-caption hover:text-ink"
                  onClick={() => dismiss(toast.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
