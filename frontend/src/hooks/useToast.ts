import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

export interface ToastContextValue {
  pushToast: (toast: ToastInput) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
