"use client";

import React, { useEffect } from 'react';

type QuestionNavPopupProps = {
  isOpen: boolean;
  total: number;
  answers: (string | null)[];
  doubtFlags: boolean[];
  current: number;
  onClose: () => void;
  onGoToQuestion: (index: number) => void;
};

export function QuestionGridLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-fg-muted">
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-primary" aria-hidden="true" /> Terjawab</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-highlight" aria-hidden="true" /> Ragu</span>
      <span className="flex items-center gap-1.5"><span className="well h-3 w-3 rounded-[4px] border border-line-strong" aria-hidden="true" /> Kosong</span>
    </div>
  );
}

export function questionTileClass({ isCurrent, isDoubt, isAnswered }: { isCurrent: boolean; isDoubt: boolean; isAnswered: boolean }) {
  const state = isDoubt
    ? 'bg-highlight text-on-highlight'
    : isAnswered
      ? 'bg-primary text-on-primary'
      : 'well well-hover text-fg';
  const ring = isCurrent ? 'ring-2 ring-fg ring-offset-2 ring-offset-canvas' : '';
  return `h-11 rounded-xl text-[14px] font-semibold tabular-nums transition-calm ${state} ${ring}`;
}

export default function QuestionNavPopup({
  isOpen,
  total,
  answers,
  doubtFlags,
  current,
  onClose,
  onGoToQuestion,
}: QuestionNavPopupProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="glass-scrim fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-nav-title"
        className="glass-sheet animate-in w-full max-w-md overflow-hidden rounded-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-5 pt-4 pb-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 id="question-nav-title" className="text-[18px] font-bold tracking-tight text-fg">Daftar soal</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <QuestionGridLegend />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
            {Array.from({ length: total }, (_, i) => {
              const isAnswered = answers[i] !== null && answers[i] !== undefined && String(answers[i]).trim().length > 0;
              const isDoubt = doubtFlags[i] || false;
              const isCurrent = i === current;
              return (
                <button
                  key={i}
                  type="button"
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Soal ${i + 1}${isDoubt ? ', ragu' : isAnswered ? ', terjawab' : ', kosong'}`}
                  onClick={() => onGoToQuestion(i)}
                  className={questionTileClass({ isCurrent, isDoubt, isAnswered })}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
