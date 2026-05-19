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
  theme = 'dark',
}: QuestionModalHeaderProps) {
  return (
    <div className={`shrink-0 flex justify-between items-center gap-3 px-4 py-3 border-b sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <h2 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
          {isAdding ? 'Add question' : isEditing ? 'Edit question' : 'Question'}
        </h2>
        {selectedQuestion && !isAdding && !isEditing && (
          <div className="flex items-center gap-1.5">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
              #{selectedQuestion.id}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
              {selectedQuestion.question_type === 'short_answer' ? 'Isian singkat' : 'Pilihan ganda'}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${selectedQuestion.is_hidden ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700') : (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700')}`}>
              {selectedQuestion.is_hidden ? 'Hidden' : 'Visible'}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
        title="Close"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
