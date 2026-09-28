"use client";

import React from 'react';
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
}: TrackingSessionHistoryPanelProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-[13px] font-semibold text-fg-muted">
        Session history
      </h3>

      {detailLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[13px] font-medium text-fg-muted" role="status">
          <span className="spinner-calm h-4 w-4" aria-hidden="true" />
          Loading history…
        </div>
      ) : detailQuestions.length === 0 ? (
        <div className="well rounded-2xl py-8 text-center text-[13px] font-medium text-fg-muted">No history yet</div>
      ) : (
        <div className="well overflow-hidden rounded-2xl">
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
                className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <span className="clay inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold tabular-nums">
                  {idx + 1}
                </span>
                <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold ${
                  isSkipped
                    ? 'well text-fg-muted'
                    : isCorrect
                    ? 'bg-primary/12 text-primary'
                    : 'bg-danger/12 text-danger'
                }`}>
                  {isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
