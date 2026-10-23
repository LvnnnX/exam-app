"use client";

import React, { useEffect } from 'react';

type RemedialQuizSuccessModalProps = {
  quizCode: string;
  questionCount: number;
  onClose: () => void;
  onGoToQuiz: () => void;
  theme?: 'light' | 'dark';
};

export default function RemedialQuizSuccessModal({
  quizCode,
  questionCount,
  onClose,
  onGoToQuiz,
  theme = 'dark',
}: RemedialQuizSuccessModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-theme={theme}
      className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remedial-success-title"
      onClick={onClose}
    >
      <div
        className="glass-sheet animate-in w-full max-w-md rounded-4xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <div className="clay-primary flex h-14 w-14 items-center justify-center rounded-2xl" aria-hidden="true">
            <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="mb-4 text-center">
          <h3 id="remedial-success-title" className="text-[20px] font-bold tracking-tight text-fg">
            Remedial quiz created
          </h3>
          <p className="mt-1.5 text-[14px] text-fg-muted">
            {questionCount} questions ready to go
          </p>
        </div>

        <div className="clay mb-5 rounded-2xl px-4 py-4 text-center">
          <p className="mb-1 text-[12px] font-medium text-fg-muted">
            Quiz code
          </p>
          <p className="text-[32px] font-bold tracking-[0.12em] tabular-nums text-fg">
            {quizCode}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onGoToQuiz}
            className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold"
          >
            Go to quiz
          </button>
        </div>
      </div>
    </div>
  );
}
