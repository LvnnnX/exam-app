"use client";

import React from 'react';

type DeletingQuestion = {
  question_text: string;
};

type DeleteQuestionConfirmModalProps = {
  deletingQuestion: DeletingQuestion | null;
  previewText: string;
  onCancel: () => void;
  onConfirm: () => void;
  theme?: 'light' | 'dark';
};

export default function DeleteQuestionConfirmModal({
  deletingQuestion,
  previewText,
  onCancel,
  onConfirm,
  theme = 'dark',
}: DeleteQuestionConfirmModalProps) {
  if (!deletingQuestion) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[9999]">
      <div className={`rounded-[24px] shadow-ios-xl max-w-md w-full p-6 ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
        <h3 className={`text-[15px] font-semibold tracking-tight mb-2 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Delete question?</h3>
        <p className={`text-[13px] leading-relaxed mb-1 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>This action cannot be undone.</p>
        <p className={`text-[12px] mb-5 truncate ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
          “{previewText}”
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-red-500 hover:bg-red-600'}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
