"use client";

import React, { useEffect } from 'react';
import { type RawQuestion } from '@/lib/questions';
import ResultDetailsHeader from '@/app/components/admin/ResultDetailsHeader';
import ResultDetailsContent from '@/app/components/admin/ResultDetailsContent';

type ResultAnswer = {
  question_id: number;
  user_answer: string;
  is_correct: boolean;
};

type ViewingResult = {
  name: string;
  mode?: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  start_time?: string;
  end_time?: string;
  score: number;
  total_questions: number;
  user_answers?: ResultAnswer[];
};

type ResultDetailsModalProps = {
  viewingResult: ViewingResult | null;
  detailLoading: boolean;
  detailQuestions: RawQuestion[];
  formatCategorySelectionLabel: (value?: string | null) => string;
  getCorrectOptionText: (question: RawQuestion) => string;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function ResultDetailsModal({
  viewingResult,
  detailLoading,
  detailQuestions,
  formatCategorySelectionLabel,
  getCorrectOptionText,
  onClose,
  theme = 'dark',
}: ResultDetailsModalProps) {
  useEffect(() => {
    if (!viewingResult) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewingResult]);

  const handleClose = () => {
    document.body.style.overflow = '';
    onClose();
  };

  useEffect(() => {
    if (!viewingResult) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        document.body.style.overflow = '';
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingResult, onClose]);

  if (!viewingResult) return null;

  return (
    <div data-theme={theme} className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Result details ${viewingResult.name}`}
        className="glass-sheet animate-in flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-4xl text-fg"
        onClick={(e) => e.stopPropagation()}
      >
        <ResultDetailsHeader
          viewingResult={viewingResult}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          onClose={handleClose}
          theme={theme}
        />
        <ResultDetailsContent
          detailLoading={detailLoading}
          viewingResult={viewingResult}
          detailQuestions={detailQuestions}
          getCorrectOptionText={getCorrectOptionText}
          theme={theme}
        />
      </div>
    </div>
  );
}
