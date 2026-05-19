"use client";

import React from 'react';
import RichContent from '@/app/components/RichContent';
import { type RawQuestion } from '@/lib/questions';
import { stripHtml } from '@/lib/rich-text';

type TrackingSessionStats = {
  current_index: number;
  question_ids: number[];
  user_answers: Record<string, string>;
};

type TrackingSessionHistoryPanelProps = {
  detailLoading: boolean;
  detailQuestions: RawQuestion[];
  trackingSession: TrackingSessionStats;
  getCorrectOptionText: (question: RawQuestion) => string;
  theme?: 'light' | 'dark';
};

export default function TrackingSessionHistoryPanel({
  detailLoading,
  detailQuestions,
  trackingSession,
  getCorrectOptionText,
  theme = 'dark',
}: TrackingSessionHistoryPanelProps) {
  return (
    <div className="space-y-3">
      <h3 className={`text-[12px] font-medium tracking-tight ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
        Session history
      </h3>

      {detailLoading ? (
        <div className={`text-center py-8 text-[12px] font-medium animate-pulse ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Loading history…</div>
      ) : detailQuestions.length === 0 ? (
        <div className={`text-center py-8 text-[12px] font-medium rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03] text-dark-text-tertiary' : 'bg-black/[0.025] text-gray-400'}`}>No history yet</div>
      ) : (
        <div className={`rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
          {trackingSession.question_ids
            .slice(0, trackingSession.current_index + 1)
            .filter(qId => detailQuestions.some(q => q.id === qId))
            .map((qId, idx) => {
            const question = detailQuestions.find(q => q.id === qId)!;
            const userAnswerText = trackingSession.user_answers[idx.toString()];

            const isShortAnswer = question.question_type === 'short_answer';
            const correctText = isShortAnswer
              ? question.short_answer
              : getCorrectOptionText(question);
            const isCorrect = stripHtml(userAnswerText || '').trim().toLowerCase() === stripHtml(correctText || '').trim().toLowerCase();
            const isSkipped = userAnswerText === 'skipped' || !userAnswerText;

            return (
              <div
                key={qId}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'}`}
              >
                <span className={`text-[12px] font-semibold tabular-nums shrink-0 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
                  Q{idx + 1}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${
                  isSkipped
                    ? theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-400'
                    : isCorrect
                    ? theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700'
                    : theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700'
                }`}>
                  {isSkipped ? 'Skipped' : isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
