"use client";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 z-[9999]">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={`rounded-[24px] shadow-ios-xl max-w-md w-full overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
        <div className="px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-500'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
              Hapus soal
            </h3>
          </div>
          <p className={`text-[13px] leading-relaxed ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
            Hapus <strong>{selectedCount} soal</strong> yang dipilih? Aksi ini tidak bisa dibatalkan.
          </p>
        </div>
        <div className={`flex justify-end gap-2 px-4 py-3 border-t sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
          <button
            type="button"
            onClick={onCancel}
            disabled={batchProcessing}
            className={`px-4 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={batchProcessing}
            className={`px-4 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 disabled:opacity-50 flex items-center gap-2 ${theme === 'dark' ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {batchProcessing && (
              <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {batchProcessing ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
