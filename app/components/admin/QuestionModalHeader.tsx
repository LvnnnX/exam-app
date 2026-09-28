"use client";

import React from 'react';
import { type RawQuestion } from '@/lib/questions';

type QuestionModalHeaderProps = {
  isAdding: boolean;
  isEditing: boolean;
  selectedQuestion: RawQuestion | null;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function QuestionModalHeader({
  isAdding,
  isEditing,
  selectedQuestion,
  onClose,
}: QuestionModalHeaderProps) {
  const chip = 'well inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold text-fg-muted';

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="text-[18px] font-bold tracking-tight text-fg">
          {isAdding ? 'Add question' : isEditing ? 'Edit question' : 'Question'}
        </h2>
        {selectedQuestion && !isAdding && !isEditing && (
          <div className="flex items-center gap-1.5">
            <span className={`${chip} tabular-nums`}>
              #{selectedQuestion.id}
            </span>
            <span className={chip}>
              {selectedQuestion.question_type === 'short_answer' ? 'Isian singkat' : 'Pilihan ganda'}
            </span>
            <span className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold ${selectedQuestion.is_hidden ? 'bg-danger/12 text-danger' : 'bg-primary/12 text-primary'}`}>
              {selectedQuestion.is_hidden ? 'Hidden' : 'Visible'}
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
        aria-label="Close"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
