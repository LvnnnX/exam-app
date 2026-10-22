"use client";

import React from 'react';

export default function PreparingQuestionView() {
  return (
    <div className="flex-1 flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="glass flex flex-col items-center rounded-3xl px-8 py-7 text-center">
        <span className="spinner-calm mb-4 h-6 w-6" aria-hidden="true" />
        <p className="mb-1 text-[15px] font-semibold text-fg">Preparing your exam</p>
        <p className="text-[13px] text-fg-muted">Loading the first question…</p>
      </div>
    </div>
  );
}
