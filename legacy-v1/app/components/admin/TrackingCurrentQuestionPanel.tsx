"use client";

import React from 'react';
import RichContent from '@/app/components/RichContent';
import { type RawQuestion } from '@/lib/questions';

type OptionLabel = 'a' | 'b' | 'c' | 'd' | 'e';

type TrackingCurrentQuestionPanelProps = {
  detailLoading: boolean;
  currentTrackedQuestion: RawQuestion | null;
  getOptionText: (question: RawQuestion, label: OptionLabel) => string;
  theme?: 'light' | 'dark';
};

const OPTION_LABELS: OptionLabel[] = ['a', 'b', 'c', 'd', 'e'];

export default function TrackingCurrentQuestionPanel({
  detailLoading,
  currentTrackedQuestion,
  getOptionText,
}: TrackingCurrentQuestionPanelProps) {
  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true"></span>
        Currently answering
      </h3>
      {detailLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading question">
          <div className="well h-20 w-full rounded-2xl"></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="well h-12 rounded-2xl"></div>
            <div className="well h-12 rounded-2xl"></div>
          </div>
        </div>
      ) : currentTrackedQuestion ? (
        <div className="space-y-4">
          <div className="well rounded-2xl px-5 py-4">
            <RichContent html={currentTrackedQuestion.question_text} className="text-[15px] font-medium leading-snug text-fg" />
          </div>
          {currentTrackedQuestion.question_type === 'short_answer' ? (
            <div className="rounded-2xl bg-primary/10 px-4 py-3">
              <p className="mb-1.5 text-[12px] font-semibold text-primary">Correct answer</p>
              <p className="text-[14px] font-medium text-fg">
                {currentTrackedQuestion.short_answer || '-'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OPTION_LABELS.map((label) => {
                const isCorrect = currentTrackedQuestion.correct_answer.toLowerCase() === label;
                return (
                  <div key={label} className={`rounded-2xl px-4 py-3 ${isCorrect ? 'bg-primary/10 ring-1 ring-primary/30' : 'well'}`}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className={`text-[12px] font-bold uppercase ${isCorrect ? 'text-primary' : 'text-fg-muted'}`}>{label}</span>
                      {isCorrect && <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Correct</span>}
                    </div>
                    <RichContent html={getOptionText(currentTrackedQuestion, label)} className="text-[14px] font-medium text-fg" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="well rounded-2xl py-12 text-center">
          <p className="text-[13px] font-medium text-fg-muted">Awaiting question synchronisation…</p>
        </div>
      )}
    </div>
  );
}
