"use client";

import React from 'react';

type ResultDetailsFooterProps = {
  score: number;
  totalQuestions: number;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function ResultDetailsFooter({
  score,
  totalQuestions,
  onClose,
}: ResultDetailsFooterProps) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
      <div className="text-[14px] font-medium text-fg-muted">
        Final score{' '}
        <span className={`font-bold tabular-nums ${score / totalQuestions >= 0.7 ? 'text-primary' : 'text-danger'}`}>{score}/{totalQuestions}</span>
      </div>
      <button type="button" onClick={onClose} className="well well-hover h-11 rounded-xl px-5 text-[14px] font-medium text-fg transition-calm">Close</button>
    </div>
  );
}
