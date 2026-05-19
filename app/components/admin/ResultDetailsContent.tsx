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
  theme = 'dark',
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
        <div className={`text-center py-20 text-[12px] font-medium animate-pulse ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
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
    <div className={`flex-1 overflow-y-auto px-6 py-6 ${theme === 'dark' ? 'result-details-scroll-dark' : 'result-details-scroll-light'}`}>
      <div className="space-y-6">
        {/* Summary */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
              <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                {userAnswers.length}
              </p>
              <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                Total
              </p>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
              <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-accent-green' : 'text-green-700'}`}>
                {correctCount}
              </p>
              <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>
                Correct
              </p>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-red/10' : 'bg-red-50'}`}>
              <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-accent-red' : 'text-red-700'}`}>
                {incorrectCount}
              </p>
              <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-red/80' : 'text-red-600'}`}>
                Incorrect
              </p>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-blue/10' : 'bg-blue-50'}`}>
              <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-accent-blue' : 'text-blue-700'}`}>
                {percentage}%
              </p>
              <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-blue/80' : 'text-blue-600'}`}>
                Score
              </p>
            </div>
          </div>
          {(viewingResult.duration_seconds != null || viewingResult.start_time) && (
            <div className={`rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
              {viewingResult.start_time && (
                <div className="flex items-center justify-between gap-3 flex-1 min-w-[140px]">
                  <span className={`text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                    Start
                  </span>
                  <span className={`text-[13px] font-semibold tabular-nums font-mono ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                    {new Date(viewingResult.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
              {viewingResult.duration_seconds != null && (
                <div className="flex items-center justify-between gap-3 flex-1 min-w-[140px]">
                  <span className={`text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                    Duration
                  </span>
                  <span className={`text-[13px] font-semibold tabular-nums font-mono ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                    {Math.floor(viewingResult.duration_seconds / 60)}m {viewingResult.duration_seconds % 60}s
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

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
                className={`rounded-2xl overflow-hidden transition-spring-fast ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}
              >
                <button
                  onClick={() => toggleQuestion(answer.question_id)}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-3 transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[12px] font-semibold tabular-nums shrink-0 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
                      Q{idx + 1}
                    </span>
                    <span className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${answer.is_correct ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700') : (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700')}`}>
                      <span className="text-[14px] leading-none">{answer.is_correct ? '✓' : '✗'}</span>
                      {answer.is_correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className={`px-4 pb-4 space-y-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
                    <div className="pt-4">
                      <p className={`text-[11px] font-medium mb-2 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                        Question
                      </p>
                      <RichContent
                        html={question.question_text}
                        className={`text-[13px] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className={`rounded-2xl px-4 py-3 ${answer.is_correct ? (theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50') : (theme === 'dark' ? 'bg-accent-red/10' : 'bg-red-50')}`}>
                        <p className={`text-[11px] font-medium mb-1.5 ${answer.is_correct ? (theme === 'dark' ? 'text-accent-green/80' : 'text-green-600') : (theme === 'dark' ? 'text-accent-red/80' : 'text-red-600')}`}>
                          User answer
                        </p>
                        <RichContent
                          html={answer.user_answer}
                          className={`text-[13px] font-medium ${answer.is_correct ? (theme === 'dark' ? 'text-accent-green' : 'text-green-800') : (theme === 'dark' ? 'text-accent-red' : 'text-red-800')}`}
                        />
                      </div>

                      {!answer.is_correct && (
                        <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
                          <p className={`text-[11px] font-medium mb-1.5 ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>
                            Correct answer{isShortAnswer ? '' : ` (${question.correct_answer})`}
                          </p>
                          <RichContent
                            html={correctText}
                            className={`text-[13px] font-medium ${theme === 'dark' ? 'text-accent-green' : 'text-green-800'}`}
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
