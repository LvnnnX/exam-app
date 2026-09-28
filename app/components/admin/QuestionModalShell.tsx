"use client";

import React, { useEffect } from 'react';
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
  const isFormMode = isAdding || isEditing;

  // Escape closes the read-only preview; the edit form keeps its draft safe.
  useEffect(() => {
    if (!isOpen || isFormMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFormMode, onClose]);

  if (!isOpen) return null;

  return (
    <div data-theme={theme} className="glass-scrim fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isAdding ? 'Add question' : isEditing ? 'Edit question' : 'Question'}
        className="glass-sheet animate-in flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-4xl text-fg"
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
