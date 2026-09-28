"use client";

import React from 'react';

type AdminAuthLoadingViewProps = {
  theme?: 'light' | 'dark';
};

export default function AdminAuthLoadingView({ theme = 'dark' }: AdminAuthLoadingViewProps) {
  return (
    <div data-theme={theme} className="flex min-h-screen items-center justify-center bg-canvas" role="status" aria-live="polite">
      <div className="glass flex flex-col items-center gap-4 rounded-3xl px-8 py-7">
        <span className="spinner-calm h-8 w-8" aria-hidden="true" />
        <p className="text-[14px] font-semibold text-fg-muted">Verifying admin session…</p>
      </div>
    </div>
  );
}
