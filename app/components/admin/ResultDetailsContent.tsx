"use client";

import React, { useState } from 'react';
import RichContent from '@/app/components/RichContent';
import { type RawQuestion } from '@/lib/questions';

type ResultAnswer = {
  question_id: number;
  user_answer: string;
  is_correct: boolean;
};

type ViewingResult = {
  user_answers?: ResultAnswer[];
  score?: number;
  total_questions?: number;
  duration_seconds?: number;
  start_time?: string;
  end_time?: string;
};

type ResultDetailsContentProps = {
  detailLoading: boolean;
  viewingResult: ViewingResult;
  detailQuestions: RawQuestion[];
  getCorrectOptionText: (question: RawQuestion) => string;
  theme?: 'light' | 'dark';
};

export default function ResultDetailsContent({
  detailLoading,
  viewingResult,
  detailQuestions,
  getCorrectOptionText,
}: ResultDetailsContentProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  const toggleQuestion = (questionId: number) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  if (detailLoading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] font-medium text-fg-muted" role="status">
          <span className="spinner-calm h-4 w-4" aria-hidden="true" />
          Loading result history...
        </div>
      </div>
    );
  }

  const userAnswers = viewingResult.user_answers || [];
  const correctCount = userAnswers.filter(a => a.is_correct).length;
  const incorrectCount = userAnswers.length - correctCount;
  const percentage = userAnswers.length > 0 ? Math.round((correctCount / userAnswers.length) * 100) : 0;

  return (
    <div className="result-details-scroll-light flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
      <div className="space-y-6">
        {/* Summary */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="clay rounded-2xl px-4 py-3">
              <p className="text-[24px] font-bold tabular-nums tracking-tight text-fg">
                {userAnswers.length}
              </p>
              <p className="text-[12px] font-medium text-fg-muted">
                Total
              </p>
            </div>
            <div className="clay rounded-2xl px-4 py-3">
              <p className="text-[24px] font-bold tabular-nums tracking-tight text-primary">
                {correctCount}
              </p>
              <p className="text-[12px] font-medium text-fg-muted">
                Correct
              </p>
            </div>
            <div className="clay rounded-2xl px-4 py-3">
              <p className="text-[24px] font-bold tabular-nums tracking-tight text-danger">
                {incorrectCount}
              </p>
              <p className="text-[12px] font-medium text-fg-muted">
                Incorrect
              </p>
            </div>
            <div className="clay rounded-2xl px-4 py-3">
              <p className="text-[24px] font-bold tabular-nums tracking-tight text-fg">
                {percentage}%
              </p>
              <p className="text-[12px] font-medium text-fg-muted">
                Score
              </p>
            </div>
          </div>
          {(viewingResult.duration_seconds != null || viewingResult.start_time) && (
            <div className="well flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-4 py-3">
              {viewingResult.start_time && (
                <div className="flex min-w-[140px] flex-1 items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-fg-muted">
                    Start
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums text-fg">
                    {new Date(viewingResult.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
              {viewingResult.duration_seconds != null && (
                <div className="flex min-w-[140px] flex-1 items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-fg-muted">
                    Duration
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums text-fg">
                    {Math.floor(viewingResult.duration_seconds / 60)}m {viewingResult.duration_seconds % 60}s
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {userAnswers.length === 0 && (
          <div className="well rounded-2xl py-10 text-center text-[13px] font-medium text-fg-muted">
            Tidak ada jawaban tercatat untuk hasil ini.
          </div>
        )}

        {/* Questions Accordion */}
        <div className="space-y-2">
          {userAnswers
            .filter(answer => detailQuestions.some(q => q.id === answer.question_id))
            .map((answer, idx) => {
            const question = detailQuestions.find(q => q.id === answer.question_id)!;

            const isExpanded = expandedQuestions.has(answer.question_id);
            const isShortAnswer = question.question_type === 'short_answer';
            const correctText = isShortAnswer ? question.short_answer : getCorrectOptionText(question);

            return (
              <div
                key={answer.question_id}
                className="well overflow-hidden rounded-2xl"
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleQuestion(answer.question_id)}
                  className="well-hover flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 transition-calm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="clay inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold tabular-nums">
                      {idx + 1}
                    </span>
                    <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold ${answer.is_correct ? 'bg-primary/12 text-primary' : 'bg-danger/12 text-danger'}`}>
                      {answer.is_correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-line px-4 pb-4">
                    <div className="pt-4">
                      <p className="mb-2 text-[12px] font-medium text-fg-muted">
                        Question
                      </p>
                      <RichContent
                        html={question.question_text}
                        className="text-[14px] text-fg"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className={`rounded-2xl px-4 py-3 ${answer.is_correct ? 'bg-primary/10' : 'bg-danger/10'}`}>
                        <p className={`mb-1.5 text-[12px] font-semibold ${answer.is_correct ? 'text-primary' : 'text-danger'}`}>
                          User answer
                        </p>
                        <RichContent
                          html={answer.user_answer}
                          className="text-[14px] font-medium text-fg"
                        />
                      </div>

                      {!answer.is_correct && (
                        <div className="rounded-2xl bg-primary/10 px-4 py-3">
                          <p className="mb-1.5 text-[12px] font-semibold text-primary">
                            Correct answer{isShortAnswer ? '' : ` (${question.correct_answer})`}
                          </p>
                          <RichContent
                            html={correctText}
                            className="text-[14px] font-medium text-fg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
