"use client";

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { scrimMotion, sheetMotion } from '@/app/components/ui/motion-presets';

type BatchVisibilityConfirmModalProps = {
  isOpen: boolean;
  batchVisibilityTarget: boolean;
  selectedCount: number;
  batchProcessing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  theme?: 'light' | 'dark';
};

export default function BatchVisibilityConfirmModal({
  isOpen,
  batchVisibilityTarget,
  selectedCount,
  batchProcessing,
  onCancel,
  onConfirm,
  theme = 'dark',
}: BatchVisibilityConfirmModalProps) {
  useEffect(() => {
    if (!isOpen || batchProcessing) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, batchProcessing, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div {...scrimMotion} data-theme={theme} className="glass-scrim fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
      <motion.div
        {...sheetMotion}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="batch-visibility-title"
        className="glass-sheet w-full max-w-md overflow-hidden rounded-4xl"
      >
        <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <div className="mb-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${batchVisibilityTarget ? 'bg-danger/12 text-danger' : 'bg-primary/12 text-primary'}`} aria-hidden="true">
              {batchVisibilityTarget ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </div>
            <h3 id="batch-visibility-title" className="text-[18px] font-bold tracking-tight text-fg">
              {batchVisibilityTarget ? 'Sembunyikan soal' : 'Tampilkan soal'}
            </h3>
          </div>
          <p className="text-[14px] leading-relaxed text-fg-muted">
            {batchVisibilityTarget ? 'Sembunyikan' : 'Tampilkan'} <strong className="text-fg">{selectedCount} soal</strong> yang dipilih?
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={batchProcessing}
            className="well well-hover h-11 rounded-xl px-5 text-[14px] font-medium text-fg transition-calm disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={batchProcessing}
            className={`flex h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold ${batchVisibilityTarget ? 'clay-danger' : 'clay-primary'}`}
          >
            {batchProcessing && <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />}
            {batchProcessing ? 'Memproses…' : 'Lanjutkan'}
          </button>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
