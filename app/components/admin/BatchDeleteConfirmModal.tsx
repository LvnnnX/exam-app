"use client";

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { scrimMotion, sheetMotion } from '@/app/components/ui/motion-presets';

type BatchDeleteConfirmModalProps = {
  isOpen: boolean;
  selectedCount: number;
  batchProcessing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  theme?: 'light' | 'dark';
};

export default function BatchDeleteConfirmModal({
  isOpen,
  selectedCount,
  batchProcessing,
  onCancel,
  onConfirm,
  theme = 'dark',
}: BatchDeleteConfirmModalProps) {
  // Escape cancels, except while the delete is running.
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
            aria-labelledby="batch-delete-title"
            aria-describedby="batch-delete-desc"
            className="glass-sheet w-full max-w-md overflow-hidden rounded-4xl"
          >
            <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/12 text-danger" aria-hidden="true">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 id="batch-delete-title" className="text-[18px] font-bold tracking-tight text-fg">
                  Hapus soal
                </h3>
              </div>
              <p id="batch-delete-desc" className="text-[14px] leading-relaxed text-fg-muted">
                Hapus <strong className="text-fg">{selectedCount} soal</strong> yang dipilih? Aksi ini tidak bisa dibatalkan.
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
                className="clay-danger flex h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold"
              >
                {batchProcessing && <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />}
                {batchProcessing ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
