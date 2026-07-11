import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastItem['variant']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastItem['variant'] = 'error') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
    </ToastContext.Provider>
  );
}
