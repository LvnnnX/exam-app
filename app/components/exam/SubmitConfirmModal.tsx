"use client";

import React from 'react';

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
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="bg-white rounded-[28px] p-6 max-w-sm w-full shadow-ios-xl animate-in zoom-in-95 duration-300">
        <h3 className="text-[17px] font-semibold tracking-tight text-nike-black mb-1">Selesai ujian?</h3>
        <p className="text-[13px] text-nike-grey-500 mb-5 tracking-tight">
          Pastikan jawaban kamu sudah dicek sebelum menyelesaikan ujian.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-full text-[13px] font-medium text-nike-black bg-black/5 hover:bg-black/10 transition-spring-fast active:scale-95 tracking-tight"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 rounded-full text-[13px] font-medium text-white bg-nike-black hover:bg-nike-grey-500 transition-spring-fast active:scale-95 tracking-tight"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
