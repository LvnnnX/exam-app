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
  theme = 'dark',
}: QuestionModalFooterProps) {
  return (
    <div className={`shrink-0 flex flex-col sm:flex-row justify-end gap-2 px-4 py-3 border-t sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
      <button
        onClick={onClose}
        className={`w-full sm:w-auto px-5 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
      >
        {isAdding || isEditing ? 'Cancel' : 'Close'}
      </button>
      {(isAdding || isEditing) && (
        <button
          onClick={onSave}
          disabled={savingQuestion}
          className={`w-full sm:w-auto px-5 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {savingQuestion ? 'Saving…' : (isAdding ? 'Create' : 'Save')}
        </button>
      )}
    </div>
  );
}
