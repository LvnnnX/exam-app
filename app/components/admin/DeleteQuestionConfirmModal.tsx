"use client";

import React, { useEffect } from 'react';

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
  useEffect(() => {
    if (!deletingQuestion) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingQuestion, onCancel]);

  if (!deletingQuestion) {
    return null;
  }

  return (
    <div data-theme={theme} className="glass-scrim fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-question-title"
        className="glass-sheet animate-in w-full max-w-md rounded-4xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-question-title" className="mb-2 text-[18px] font-bold tracking-tight text-fg">Delete question?</h3>
        <p className="mb-2 text-[14px] leading-relaxed text-fg-muted">This action cannot be undone.</p>
        <p className="well mb-6 truncate rounded-xl px-3 py-2 text-[13px] text-fg">
          “{previewText}”
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="well well-hover h-11 rounded-xl px-5 text-[14px] font-medium text-fg transition-calm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="clay-danger h-11 rounded-xl px-5 text-[14px] font-semibold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
