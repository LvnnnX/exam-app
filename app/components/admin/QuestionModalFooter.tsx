"use client";

import React from 'react';

type QuestionModalFooterProps = {
  isAdding: boolean;
  isEditing: boolean;
  savingQuestion: boolean;
  onClose: () => void;
  onSave: () => void;
  theme?: 'light' | 'dark';
};

export default function QuestionModalFooter({
  isAdding,
  isEditing,
  savingQuestion,
  onClose,
  onSave,
}: QuestionModalFooterProps) {
  return (
    <div className="flex shrink-0 flex-col justify-end gap-2 border-t border-line px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
      <button
        type="button"
        onClick={onClose}
        className="well well-hover h-11 w-full rounded-xl px-5 text-[14px] font-medium text-fg transition-calm sm:w-auto"
      >
        {isAdding || isEditing ? 'Cancel' : 'Close'}
      </button>
      {(isAdding || isEditing) && (
        <button
          type="button"
          onClick={onSave}
          disabled={savingQuestion}
          className="clay-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-[14px] font-semibold sm:w-auto"
        >
          {savingQuestion && <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />}
          {savingQuestion ? 'Saving…' : (isAdding ? 'Create' : 'Save')}
        </button>
      )}
    </div>
  );
}
