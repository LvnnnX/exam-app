"use client";

import React, { useEffect } from 'react';

type SurrenderConfirmModalProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SurrenderConfirmModal({
  isOpen,
  onCancel,
  onConfirm,
}: SurrenderConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="glass-scrim fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="surrender-title"
        aria-describedby="surrender-desc"
        className="glass-sheet animate-in flex w-full max-w-[340px] flex-col items-center rounded-4xl px-6 py-7 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/12 text-danger" aria-hidden="true">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4v17" />
            <path d="M4 4h13l-2 4 2 4H4" />
          </svg>
        </div>

        <h3 id="surrender-title" className="mb-1.5 text-[20px] font-bold tracking-tight text-fg">
          Menyerah sekarang?
        </h3>
        <p id="surrender-desc" className="text-[14px] leading-relaxed text-fg-muted">
          Sesi survival akan berakhir dan skormu akan tercatat.
        </p>

        <span className="mt-4 inline-flex h-7 items-center rounded-lg bg-danger/10 px-3 text-[12px] font-semibold text-danger">
          Skor saat ini disimpan
        </span>

        <div className="mt-6 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="clay-danger h-11 w-full rounded-xl text-[14px] font-semibold"
          >
            Ya, menyerah
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="well well-hover h-11 w-full rounded-xl text-[14px] font-medium text-fg transition-calm"
          >
            Lanjut bertahan
          </button>
        </div>
      </div>
    </div>
  );
}
