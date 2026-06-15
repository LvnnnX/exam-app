"use client";

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import DOMPurify from 'dompurify';
import { type RawQuestion } from '@/lib/questions';
import RichContent from '@/app/components/RichContent';

type ScheduledExamQuestionsModalProps = {
  isOpen: boolean;
  questions: RawQuestion[];
  getCorrectOptionText: (question: RawQuestion) => string;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

/** Strip all HTML tags, return plain text */
function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

function OptionRow({
  label,
  text,
  isCorrect,
  theme,
}: {
  label: string;
  text: string;
  isCorrect: boolean;
  theme: 'light' | 'dark';
}) {
  const isDark = theme === 'dark';
  const cleanText = stripHtml(text);
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[12px] ${
        isCorrect
          ? isDark
            ? 'bg-accent-green/10 border border-accent-green/30'
            : 'bg-green-50 border border-green-200'
          : isDark
          ? 'bg-white/[0.03]'
          : 'bg-black/[0.02]'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase ${
          isCorrect
            ? isDark
              ? 'bg-accent-green/20 text-accent-green'
              : 'bg-green-200 text-green-700'
            : isDark
            ? 'bg-white/5 text-dark-text-tertiary'
            : 'bg-black/5 text-gray-400'
        }`}
      >
        {label}
      </span>
      <span
        className={`flex-1 leading-snug ${
          isCorrect
            ? isDark
              ? 'text-accent-green font-semibold'
              : 'text-green-700 font-semibold'
            : isDark
            ? 'text-dark-text-secondary'
            : 'text-gray-600'
        }`}
      >
        {cleanText}
      </span>
    </div>
  );
}

export default function ScheduledExamQuestionsModal({
  isOpen,
  questions,
  getCorrectOptionText,
  onClose,
  theme = 'dark',
}: ScheduledExamQuestionsModalProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const isDark = theme === 'dark';

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[10001]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`rounded-[24px] shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-dark-800 border border-dark-border-subtle' : 'bg-white border border-nike-grey-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b ${isDark ? 'border-dark-border-subtle' : 'border-nike-grey-200'}`}>
              <div className="flex flex-col gap-1">
                <h2 className={`text-[15px] font-semibold tracking-tight ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                  Bank Soal
                </h2>
                <p className={`text-[11px] ${isDark ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                  {questions.length} soal dalam pool
                </p>
              </div>
              <button
                onClick={onClose}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${isDark ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className={`flex-1 overflow-y-auto px-5 py-4 space-y-2 ${isDark ? 'bg-dark-800' : 'bg-white'}`}>
              {questions.length === 0 ? (
                <div className={`py-10 text-center text-[13px] ${isDark ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                  Tidak ada soal dalam pool.
                </div>
              ) : (
                questions.map((q, idx) => {
                  const isExp = expanded.has(q.id);
                  const correctText = getCorrectOptionText(q);
                  const correctLabel = (q.correct_answer || 'a').toLowerCase();
                  const labels: Array<'a' | 'b' | 'c' | 'd' | 'e'> = ['a', 'b', 'c', 'd', 'e'];

                  return (
                    <div
                      key={q.id}
                      className={`rounded-2xl border overflow-hidden ${isDark ? 'border-dark-border-subtle' : 'border-nike-grey-200'}`}
                    >
                      {/* Accordion trigger */}
                      <button
                        type="button"
                        onClick={() => toggle(q.id)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-spring-fast ${isDark ? 'bg-white/[0.02] hover:bg-white/[0.04]' : 'bg-black/[0.02] hover:bg-black/[0.04]'}`}
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-blue/15 text-[10px] font-bold text-accent-blue ${isDark ? '' : 'bg-blue-50 text-blue-600'}`}>
                            {idx + 1}
                          </span>
                          <span className={`text-[12px] font-medium leading-snug line-clamp-2 ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                            {stripHtml(q.question_text).slice(0, 80)}{stripHtml(q.question_text).length > 80 ? '…' : ''}
                          </span>
                        </div>
                        {isExp ? (
                          <ChevronUp size={14} className={isDark ? 'text-dark-text-tertiary shrink-0' : 'text-gray-400 shrink-0'} />
                        ) : (
                          <ChevronDown size={14} className={isDark ? 'text-dark-text-tertiary shrink-0' : 'text-gray-400 shrink-0'} />
                        )}
                      </button>

                      {/* Accordion content */}
                      {isExp && (
                        <div className={`px-4 pb-4 space-y-2 ${isDark ? 'border-t border-dark-border-subtle' : 'border-t border-nike-grey-100'}`}>
                          <div className="pt-3">
                            <RichContent html={q.question_text} className="text-[12px] [&_p]:mb-1" />
                          </div>

                          {q.question_type === 'multiple_choice' ? (
                            <>
                              <div className="space-y-1.5">
                                {labels.map((l) => (
                                  <OptionRow
                                    key={l}
                                    label={l}
                                    text={
                                      l === 'a' ? q.option_a :
                                      l === 'b' ? q.option_b :
                                      l === 'c' ? q.option_c :
                                      l === 'd' ? q.option_d :
                                      q.option_e
                                    }
                                    isCorrect={l === correctLabel}
                                    theme={theme}
                                  />
                                ))}
                              </div>
                              <div className={`mt-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold ${isDark ? 'bg-accent-green/10 text-accent-green' : 'bg-green-50 text-green-700'}`}>
                                Jawaban benar: {correctLabel.toUpperCase()} — {correctText}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className={`rounded-xl px-3 py-2 text-[12px] font-medium ${isDark ? 'bg-accent-purple/10 text-accent-purple' : 'bg-purple-50 text-purple-700'}`}>
                                Tipe: Isian
                              </div>
                              <div className={`rounded-xl border px-3 py-2 text-[12px] ${isDark ? 'border-dark-border-subtle bg-white/[0.03] text-dark-text-secondary' : 'border-nike-grey-200 bg-black/[0.02] text-gray-700'}`}>
                                <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Jawaban singkat: </span>
                                <span className="font-semibold">{q.short_answer ? stripHtml(q.short_answer) : '-'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
