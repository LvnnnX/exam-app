"use client";

import React from 'react';
import ExamIntro from '@/app/components/exam/ExamIntro';

// Same frame as the setup screen, so the heading stays put once the saved
// session (or a fresh setup form) appears below it.
export default function RestoringSessionView() {
  return (
    <div className="flex-1 flex flex-col px-4 pt-8 pb-12 sm:px-6 md:pt-14">
      <div className="mx-auto w-full max-w-xl">
        <ExamIntro />
        <div className="flex items-center gap-3 text-[14px] font-medium text-fg-muted" role="status" aria-live="polite">
          <span className="spinner-calm h-4 w-4" aria-hidden="true" />
          Memulihkan sesi…
        </div>
      </div>
    </div>
  );
}
