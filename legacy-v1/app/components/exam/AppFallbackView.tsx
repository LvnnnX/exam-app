"use client";

import React from 'react';

type AppFallbackViewProps = {
  onReset: () => void;
};

export default function AppFallbackView({ onReset }: AppFallbackViewProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="glass max-w-sm rounded-3xl px-7 py-7 text-center" role="alert">
        <p className="mb-1 text-[16px] font-semibold text-fg">Something went wrong</p>
        <p className="mb-5 text-[14px] text-fg-muted">Reset the session and try again.</p>
        <button type="button" onClick={onReset} className="clay-primary h-11 rounded-xl px-6 text-[14px] font-semibold">
          Reset session
        </button>
      </div>
    </div>
  );
}
