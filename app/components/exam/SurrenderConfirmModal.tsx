"use client";

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

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
      {/* Grows out of the Surrender button in QuestionActionButtons (shared layoutId). */}
      <motion.div
        layoutId="surrender-expandable"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="surrender-title"
        aria-describedby="surrender-desc"
        className="glass-sheet flex w-full max-w-[360px] flex-col rounded-4xl px-6 py-7"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="surrender-title" className="mb-1.5 text-[20px] font-bold tracking-tight text-fg">
          Menyerah sekarang?
        </h3>
        <p id="surrender-desc" className="text-[14px] leading-relaxed text-fg-muted">
          Sesi survival akan langsung berakhir. Skor saat ini tetap disimpan sebagai hasil akhir.
        </p>
        <p className="mt-2 text-[13px] text-fg-muted">
          Kamu masih bisa lanjut bertahan kalau belum yakin.
        </p>

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
      </motion.div>
    </div>
  );
}
