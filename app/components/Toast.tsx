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
    error: theme === 'dark' ? 'bg-accent-red/90 text-white' : 'bg-red-500 text-white',
    success: theme === 'dark' ? 'bg-accent-green/90 text-white' : 'bg-green-500 text-white',
    info: theme === 'dark' ? 'bg-accent-blue/90 text-white' : 'bg-blue-500 text-white',
    warning: theme === 'dark' ? 'bg-accent-orange/90 text-white' : 'bg-orange-500 text-white',
  };

  return (
    <div
      className={`${typeStyles[toast.type]} rounded-xl px-4 py-3 shadow-ios-lg backdrop-blur-md transition-all duration-300 ${
        isExiting
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-5 fade-in'
      }`}
      role="alert"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{toast.message}</p>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <span className="text-lg leading-none">×</span>
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
    <div className="fixed bottom-4 right-4 z-[100000] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} theme={theme} />
      ))}
    </div>
  );
}
