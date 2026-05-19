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
  const accent = isCorrect ? '#30d158' : '#ff453a';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4 bg-black/[0.04] backdrop-blur-[6px] transition-spring-fast"
      style={{ ['--accent' as string]: accent } as React.CSSProperties}
    >
      <div className="relative animate-in zoom-in-95 fade-in duration-300">
        <div
          className="absolute inset-0 rounded-[36px] blur-2xl opacity-60"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />

        <div className="relative rounded-[32px] px-8 py-7 max-w-[280px] w-[280px] bg-white/85 backdrop-blur-2xl shadow-ios-xl flex flex-col items-center text-center">
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-full mb-4"
            style={{ backgroundColor: `${accent}1f` }}
          >
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ backgroundColor: `${accent}33` }}
              aria-hidden="true"
            />
            {isCorrect ? (
              <svg className="relative w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="relative w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            )}
          </div>

          <h3 className="text-[22px] font-semibold tracking-tight text-nike-black mb-1">
            {isCorrect ? 'Benar' : 'Salah'}
          </h3>
          <p className="text-[12px] font-medium text-nike-grey-500 tracking-tight">
            {isCorrect ? 'Pertahankan momentum.' : 'Tetap fokus, jangan menyerah.'}
          </p>

          <span
            className="mt-4 inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold tracking-tight"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            {isCorrect ? '+1 score' : '−1 nyawa'}
          </span>
        </div>
      </div>
    </div>
  );
}

