"use client";

import React, { useEffect } from 'react';

type SubmitConfirmModalProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SubmitConfirmModal({
  isOpen,
  onCancel,
  onConfirm,
}: SubmitConfirmModalProps) {
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
    <div className="glass-scrim fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="submit-confirm-title"
        aria-describedby="submit-confirm-desc"
        className="glass-sheet animate-in w-full max-w-sm rounded-4xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="submit-confirm-title" className="mb-1.5 text-[20px] font-bold tracking-tight text-fg">Selesai ujian?</h3>
        <p id="submit-confirm-desc" className="mb-6 text-[14px] leading-relaxed text-fg-muted">
          Pastikan jawaban kamu sudah dicek sebelum menyelesaikan ujian.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
