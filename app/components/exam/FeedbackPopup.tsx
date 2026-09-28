"use client";

import React from 'react';

type FeedbackResult = 'correct' | 'wrong' | null;

type FeedbackPopupProps = {
  feedbackResult: FeedbackResult;
};

export default function FeedbackPopup({ feedbackResult }: FeedbackPopupProps) {
  if (!feedbackResult) {
    return null;
  }

  const isCorrect = feedbackResult === 'correct';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4"
      role="status"
      aria-live="assertive"
    >
      <div className="glass-strong animate-in flex w-[280px] max-w-full flex-col items-center rounded-4xl px-8 py-7 text-center">
        <div
          className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${isCorrect ? 'clay-primary' : 'clay-danger'}`}
          aria-hidden="true"
        >
          {isCorrect ? (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          )}
        </div>

        <h3 className="mb-1 text-[22px] font-bold tracking-tight text-fg">
          {isCorrect ? 'Benar' : 'Salah'}
        </h3>
        <p className="text-[13px] font-medium text-fg-muted">
          {isCorrect ? 'Pertahankan momentum.' : 'Tetap fokus, jangan menyerah.'}
        </p>

        <span
          className={`mt-4 inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-semibold ${isCorrect ? 'bg-primary/12 text-primary' : 'bg-danger/12 text-danger'}`}
        >
          {isCorrect ? '+1 score' : '−1 nyawa'}
        </span>
      </div>
    </div>
  );
}
