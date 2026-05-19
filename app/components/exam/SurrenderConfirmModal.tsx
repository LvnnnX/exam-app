"use client";

import React from 'react';

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
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-2xl px-4">
      <div className="relative animate-in fade-in zoom-in duration-200">
        <div
          className="absolute inset-0 rounded-[36px] blur-2xl opacity-50 bg-nike-red"
          aria-hidden="true"
        />

        <div className="relative bg-white/90 backdrop-blur-2xl rounded-[32px] px-6 py-7 max-w-[320px] w-[320px] shadow-ios-xl flex flex-col items-center text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-nike-red/15 mb-4">
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-25 bg-nike-red"
              aria-hidden="true"
            />
            <svg className="relative w-8 h-8 text-nike-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4v17" />
              <path d="M4 4h13l-2 4 2 4H4" />
            </svg>
          </div>

          <h3 className="text-[20px] font-semibold tracking-tight text-nike-black mb-1">
            Menyerah sekarang?
          </h3>
          <p className="text-[13px] text-nike-grey-500 tracking-tight leading-relaxed">
            Sesi survival akan berakhir dan skormu akan tercatat.
          </p>

          <span className="mt-4 inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-nike-red/10 text-nike-red text-[11px] font-semibold tracking-tight">
            Skor saat ini disimpan
          </span>

          <div className="w-full flex flex-col gap-2 mt-6">
            <button
              onClick={onConfirm}
              className="w-full h-11 rounded-full bg-nike-red text-white text-[13px] font-medium hover:bg-red-600 transition-spring-fast active:scale-95 tracking-tight shadow-ios-sm"
            >
              Ya, menyerah
            </button>
            <button
              onClick={onCancel}
              className="w-full h-11 rounded-full bg-black/5 text-nike-black text-[13px] font-medium hover:bg-black/10 transition-spring-fast active:scale-95 tracking-tight"
            >
              Lanjut bertahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
