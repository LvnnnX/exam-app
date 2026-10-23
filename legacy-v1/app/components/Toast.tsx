"use client";

import React, { useEffect } from 'react';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastProps = {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
  theme?: 'light' | 'dark';
};

export function Toast({ toast, onDismiss, theme = 'dark' }: ToastProps) {
  const [isExiting, setIsExiting] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss(toast.id);
      }, 300); // Wait for fade-out animation to complete
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300); // Wait for fade-out animation to complete
  };

  const typeStyles = {
    error: 'bg-danger/15 text-danger',
    success: 'bg-primary/15 text-primary',
    info: 'well text-fg-muted',
    warning: 'bg-warn/15 text-highlight-fg',
  };

  const typeIcon = {
    error: <path d="M6 6l12 12M18 6L6 18" />,
    success: <path d="M5 13l4 4L19 7" />,
    info: <path d="M12 8h.01M11 12h1v5h1" />,
    warning: <path d="M12 8v5M12 16.5h.01" />,
  };

  return (
    <div
      data-theme={theme}
      className={`glass-strong rounded-2xl py-2.5 pl-2.5 pr-1.5 text-fg transition-all duration-300 ${
        isExiting
          ? 'translate-x-6 opacity-0'
          : 'animate-in translate-x-0 opacity-100'
      }`}
      role={toast.type === 'error' ? 'alert' : 'status'}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeStyles[toast.type]}`} aria-hidden="true">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            {typeIcon[toast.type]}
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-[14px] font-semibold">{toast.message}</p>
        <button
          type="button"
          onClick={handleDismiss}
          className="well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-calm hover:text-fg"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden="true">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

type ToastContainerProps = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  theme?: 'light' | 'dark';
};

export function ToastContainer({ toasts, onDismiss, theme = 'dark' }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100000] flex flex-col gap-2 sm:left-auto sm:w-full sm:max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} theme={theme} />
      ))}
    </div>
  );
}
