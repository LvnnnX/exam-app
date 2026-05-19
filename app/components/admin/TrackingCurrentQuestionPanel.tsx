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
  theme = 'dark',
}: TrackingCurrentQuestionPanelProps) {
  return (
    <div>
      <h3 className={`text-[12px] font-medium tracking-tight mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-accent-green' : 'text-green-600'}`}>
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${theme === 'dark' ? 'bg-accent-green' : 'bg-green-500'}`}></span>
        Currently answering
      </h3>
      {detailLoading ? (
        <div className="animate-pulse space-y-3">
          <div className={`h-20 rounded-2xl w-full ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}></div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`h-12 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}></div>
            <div className={`h-12 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}></div>
          </div>
        </div>
      ) : currentTrackedQuestion ? (
        <div className="space-y-4">
          <div className={`px-5 py-4 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
            <RichContent html={currentTrackedQuestion.question_text} className={`text-[15px] font-medium leading-snug ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`} />
          </div>
          {currentTrackedQuestion.question_type === 'short_answer' ? (
            <div className={`px-4 py-3 rounded-2xl ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
              <p className={`text-[11px] font-medium mb-1.5 ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>Correct answer</p>
              <p className={`text-[13px] font-medium ${theme === 'dark' ? 'text-accent-green' : 'text-green-800'}`}>
                {currentTrackedQuestion.short_answer || '-'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPTION_LABELS.map((label) => {
                const isCorrect = currentTrackedQuestion.correct_answer.toLowerCase() === label;
                return (
                  <div key={label} className={`px-4 py-3 rounded-2xl transition-all ${isCorrect ? (theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50') : (theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]')}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-medium uppercase ${isCorrect ? (theme === 'dark' ? 'text-accent-green/80' : 'text-green-600') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400')}`}>{label}</span>
                      {isCorrect && <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${theme === 'dark' ? 'bg-accent-green/20 text-accent-green' : 'bg-green-100 text-green-700'}`}>Correct</span>}
                    </div>
                    <RichContent html={getOptionText(currentTrackedQuestion, label)} className={`text-[13px] font-medium ${isCorrect ? (theme === 'dark' ? 'text-accent-green' : 'text-green-800') : (theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-800')}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className={`py-12 text-center rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
          <p className={`text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Awaiting question synchronisation…</p>
        </div>
      )}
    </div>
  );
}
