"use client";

import React from 'react';
import { type RawQuestion } from '@/lib/questions';
import QuestionModalHeader from '@/app/components/admin/QuestionModalHeader';
import QuestionModalFooter from '@/app/components/admin/QuestionModalFooter';

type QuestionModalShellProps = {
  isOpen: boolean;
  isAdding: boolean;
  isEditing: boolean;
  selectedQuestion: RawQuestion | null;
  savingQuestion: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
  theme?: 'light' | 'dark';
};

export default function QuestionModalShell({
  isOpen,
  isAdding,
  isEditing,
  selectedQuestion,
  savingQuestion,
  onClose,
  onSave,
  children,
  theme = 'dark',
}: QuestionModalShellProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 z-[9999]">
      <div
        className={`flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <QuestionModalHeader
          isAdding={isAdding}
          isEditing={isEditing}
          selectedQuestion={selectedQuestion}
          onClose={onClose}
          theme={theme}
        />

        {children}

        <QuestionModalFooter
          isAdding={isAdding}
          isEditing={isEditing}
          savingQuestion={savingQuestion}
          onClose={onClose}
          onSave={onSave}
          theme={theme}
        />
      </div>
    </div>
  );
}
