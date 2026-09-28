"use client";

import React from 'react';

export default function RestoringSessionView() {
  return (
    <div className="flex-1 flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-[14px] font-medium text-fg-muted">
        <span className="spinner-calm h-4 w-4" aria-hidden="true" />
        Restoring session…
      </div>
    </div>
  );
}
