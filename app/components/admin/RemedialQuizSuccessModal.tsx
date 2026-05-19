"use client";

import React from 'react';

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
  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-2xl z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-md rounded-[24px] shadow-ios-xl p-6 ${
          theme === 'dark' ? 'bg-dark-800' : 'bg-white'
        }`}
      >
        {/* Success Icon */}
        <div className="mb-4 flex justify-center">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              theme === 'dark' ? 'bg-accent-green/15' : 'bg-green-50'
            }`}
          >
            <svg
              className={`h-5 w-5 ${
                theme === 'dark' ? 'text-accent-green' : 'text-green-600'
              }`}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="mb-4 text-center">
          <h3
            className={`text-[15px] font-semibold tracking-tight ${
              theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
            }`}
          >
            Remedial quiz created
          </h3>
          <p
            className={`mt-1.5 text-[13px] ${
              theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
            }`}
          >
            {questionCount} questions ready to go
          </p>
        </div>

        {/* Quiz Code */}
        <div
          className={`mb-5 rounded-2xl px-4 py-4 text-center ${
            theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'
          }`}
        >
          <p
            className={`mb-1 text-[11px] font-medium ${
              theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
            }`}
          >
            Quiz code
          </p>
          <p
            className={`text-3xl font-semibold tracking-tight font-mono tabular-nums ${
              theme === 'dark' ? 'text-accent-blue' : 'text-blue-600'
            }`}
          >
            {quizCode}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onGoToQuiz}
            className={`flex-1 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            Go to quiz
          </button>
        </div>
      </div>
    </div>
  );
}
