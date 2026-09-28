"use client";

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

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
      {/* Grows out of the "Join with code" button on the setup screen (shared layoutId). */}
      <motion.div
        layoutId="join-quiz-expandable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-quiz-title"
        className="glass-sheet w-full max-w-sm overflow-hidden rounded-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 pt-7 pb-5 text-center">
          <p className="mb-1.5 text-[12px] font-medium text-fg-muted">Join live quiz</p>
          <h2 id="join-quiz-title" className="mb-1.5 text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-fg">
            Enter quiz code.
          </h2>
          <p className="mb-6 text-[13px] text-fg-muted">{quizCodeLength}-digit code from your host.</p>

          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={quizCodeLength}
            value={quizCode}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="000000"
            aria-label="Kode kuis"
            aria-invalid={Boolean(codeError)}
            className={`h-14 w-full rounded-xl px-5 text-center text-[24px] font-semibold tracking-[0.25em] tabular-nums transition-calm placeholder:text-fg-subtle/60 ${codeError ? 'bg-danger/10 text-danger' : 'well text-fg'}`}
          />
          {codeError && (
            <p className="mt-2 text-[13px] font-medium text-danger" role="alert">
              {codeError}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onJoin}
            disabled={isCheckingCode || !canJoin}
            className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold"
          >
            {isCheckingCode ? 'Verifying…' : 'Join'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
