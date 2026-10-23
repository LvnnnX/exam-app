"use client";

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { scrimMotion, sheetMotion } from '@/app/components/ui/motion-presets';

type DeleteTopicError = {
  message: string;
  questionIds: number[];
};

type DeleteTopicErrorModalProps = {
  error: DeleteTopicError | null;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function DeleteTopicErrorModal({ error, onClose, theme = 'dark' }: DeleteTopicErrorModalProps) {
  useEffect(() => {
    if (!error) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [error, onClose]);

  return (
    <AnimatePresence>
      {error && (
    <motion.div {...scrimMotion} data-theme={theme} className="glass-scrim fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <motion.div
        {...sheetMotion}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-topic-error-title"
        className="glass-sheet w-full max-w-md overflow-hidden rounded-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/12 text-danger" aria-hidden="true">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 id="delete-topic-error-title" className="text-[18px] font-bold tracking-tight text-fg">Tidak dapat menghapus</h3>
          </div>
          <p className="mb-4 text-[14px] leading-relaxed text-fg-muted">{error.message}</p>
          <div className="well rounded-2xl px-4 py-3">
            <p className="mb-2 text-[12px] font-medium text-fg-muted">ID soal terdampak</p>
            <div className="flex flex-wrap gap-1.5">
              {error.questionIds.map(id => (
                <span key={id} className="rounded-md bg-danger/12 px-2 py-1 text-[12px] font-semibold tabular-nums text-danger">
                  #{id}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="clay-primary h-11 rounded-xl px-6 text-[14px] font-semibold"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
