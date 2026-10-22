"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import { type RawQuestion } from '@/lib/questions';
import RichContent from '@/app/components/RichContent';
import { scrimMotion, sheetMotion } from '@/app/components/ui/motion-presets';

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
}: {
  label: string;
  text: string;
  isCorrect: boolean;
}) {
  const cleanText = stripHtml(text);
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px] ${isCorrect ? 'bg-primary/10 ring-1 ring-primary/30' : 'well'}`}>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold uppercase ${isCorrect ? 'bg-primary text-on-primary' : 'clay'}`}
      >
        {label}
      </span>
      <span className={`flex-1 pt-0.5 leading-snug ${isCorrect ? 'font-semibold text-fg' : 'text-fg-muted'}`}>
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

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...scrimMotion}
          data-theme={theme}
          className="glass-scrim fixed inset-0 z-[10001] flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            {...sheetMotion}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduled-questions-title"
            className="glass-sheet flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-4xl text-fg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <h2 id="scheduled-questions-title" className="text-[20px] font-bold tracking-tight text-fg">
                  Bank soal
                </h2>
                <p className="text-[13px] tabular-nums text-fg-muted">
                  {questions.length} soal dalam pool
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4 sm:px-6">
              {questions.length === 0 ? (
                <div className="well rounded-2xl py-10 text-center text-[13px] text-fg-muted">
                  Tidak ada soal dalam pool.
                </div>
              ) : (
                questions.map((q, idx) => {
                  const isExp = expanded.has(q.id);
                  const correctText = getCorrectOptionText(q);
                  const correctLabel = (q.correct_answer || 'a').toLowerCase();
                  const labels: Array<'a' | 'b' | 'c' | 'd' | 'e'> = ['a', 'b', 'c', 'd', 'e'];
                  const plain = stripHtml(q.question_text);

                  return (
                    <div key={q.id} className="well overflow-hidden rounded-2xl">
                      {/* Accordion trigger */}
                      <button
                        type="button"
                        onClick={() => toggle(q.id)}
                        aria-expanded={isExp}
                        className="well-hover flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-calm"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <span className="clay flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="line-clamp-2 pt-0.5 text-[14px] font-medium leading-snug text-fg">
                            {plain.slice(0, 80)}{plain.length > 80 ? '…' : ''}
                          </span>
                        </div>
                        <ChevronDown size={16} className={`shrink-0 text-fg-subtle transition-transform ${isExp ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>

                      {/* Accordion content */}
                      {isExp && (
                        <div className="space-y-2 border-t border-line px-4 pb-4">
                          <div className="pt-3">
                            <RichContent html={q.question_text} className="text-[14px] text-fg [&_p]:mb-1" />
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
                                  />
                                ))}
                              </div>
                              <div className="rounded-xl bg-primary/12 px-3 py-2 text-[13px] font-semibold text-primary">
                                Jawaban benar: {correctLabel.toUpperCase()}. {correctText}
                              </div>
                            </>
                          ) : (
                            <div className="well rounded-xl px-3 py-2.5 text-[13px]">
                              <span className="text-[12px] font-medium text-fg-muted">Isian, jawaban singkat: </span>
                              <span className="font-semibold text-fg">{q.short_answer ? stripHtml(q.short_answer) : '-'}</span>
                            </div>
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
