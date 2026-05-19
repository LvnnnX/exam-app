"use client";

import React from 'react';

type JoinQuizModalProps = {
  isOpen: boolean;
  quizCodeLength: number;
  quizCode: string;
  codeError: string;
  isCheckingCode: boolean;
  canJoin: boolean;
  onCodeChange: (value: string) => void;
  onJoin: () => void;
  onClose: () => void;
};

export default function JoinQuizModal({
  isOpen,
  quizCodeLength,
  quizCode,
  codeError,
  isCheckingCode,
  canJoin,
  onCodeChange,
  onJoin,
  onClose,
}: JoinQuizModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-ios-xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-6 pt-8 pb-6 text-center">
          <p className="text-[12px] font-medium text-nike-grey-500 mb-2 tracking-tight">Join live quiz</p>
          <h2 className="font-display text-[28px] text-nike-black leading-[1.1] tracking-[-0.02em] mb-2">
            Enter quiz code.
          </h2>
          <p className="text-[13px] text-nike-grey-500 mb-6 tracking-tight">{quizCodeLength}-digit code from your host.</p>

          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={quizCodeLength}
              value={quizCode}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder="000000"
              className={`w-full h-14 rounded-2xl px-5 text-center text-[24px] font-semibold tracking-[0.25em] tabular-nums transition-spring-fast focus:outline-none ${codeError ? 'bg-red-50 text-nike-red' : 'bg-black/5 text-nike-black focus:bg-black/10'
                }`}
            />
            {codeError && (
              <p className="mt-2 text-[12px] font-medium text-nike-red tracking-tight animate-in slide-in-from-top-1">
                {codeError}
              </p>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={onJoin}
            disabled={isCheckingCode || !canJoin}
            className="w-full h-12 rounded-full bg-nike-black text-white text-[14px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] disabled:bg-black/5 disabled:text-nike-grey-500 tracking-tight shadow-ios-sm"
          >
            {isCheckingCode ? 'Verifying…' : 'Join'}
          </button>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-full bg-transparent text-nike-grey-500 text-[14px] font-medium hover:bg-black/5 transition-spring-fast active:scale-95 tracking-tight"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
