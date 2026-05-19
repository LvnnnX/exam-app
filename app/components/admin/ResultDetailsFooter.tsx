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
  theme = 'dark',
}: ResultDetailsFooterProps) {
  return (
    <div className={`shrink-0 flex flex-col gap-3 px-4 py-3 border-t sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
      <div className={`text-[13px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>
        Final score{' '}
        <span className={`font-semibold tabular-nums ${score / totalQuestions >= 0.7 ? (theme === 'dark' ? 'text-accent-green' : 'text-green-600') : (theme === 'dark' ? 'text-accent-red' : 'text-red-600')}`}>{score}/{totalQuestions}</span>
      </div>
      <button onClick={onClose} className={`px-5 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}>Close</button>
    </div>
  );
}
