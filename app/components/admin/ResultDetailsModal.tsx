"use client";

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

  return (
    <AnimatePresence>
      {viewingResult && (
    <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[10000]" onClick={handleClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className={`rounded-[28px] shadow-ios-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
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
      </motion.div>
      </motion.div>
      )}
      </AnimatePresence>
  );
}
