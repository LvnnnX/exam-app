"use client";

import React from 'react';

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
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 z-[9999]">
      <div className={`rounded-[24px] shadow-ios-xl max-w-md w-full overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
        <div className="px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${batchVisibilityTarget ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-500') : (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-500')}`}>
              {batchVisibilityTarget ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </div>
            <h3 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
              {batchVisibilityTarget ? 'Sembunyikan soal' : 'Tampilkan soal'}
            </h3>
          </div>
          <p className={`text-[13px] leading-relaxed ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
            {batchVisibilityTarget ? 'Sembunyikan' : 'Tampilkan'} <strong>{selectedCount} soal</strong> yang dipilih?
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
            className={`px-4 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 disabled:opacity-50 flex items-center gap-2 ${batchVisibilityTarget ? (theme === 'dark' ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-red-500 hover:bg-red-600') : (theme === 'dark' ? 'bg-accent-green hover:bg-accent-green/90' : 'bg-green-500 hover:bg-green-600')}`}
          >
            {batchProcessing && (
              <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {batchProcessing ? 'Memproses…' : 'Lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  );
}
