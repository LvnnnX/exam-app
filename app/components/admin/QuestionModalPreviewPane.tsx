"use client";

import React from 'react';
import RichContent from '@/app/components/RichContent';
import { type RawQuestion } from '@/lib/questions';

type OptionLabel = 'a' | 'b' | 'c' | 'd' | 'e';

type QuestionModalPreviewPaneProps = {
  selectedQuestion: RawQuestion | null;
  getOptionText: (question: RawQuestion, label: OptionLabel) => string;
  formatCategorySelectionLabel: (value?: string | null) => string;
  theme?: 'light' | 'dark';
};

const OPTION_LABELS: OptionLabel[] = ['a', 'b', 'c', 'd', 'e'];

function TopicChip({
  label,
  items,
  formatCategorySelectionLabel,
  theme = 'dark'
}: {
  label: string;
  items: string[];
  formatCategorySelectionLabel: (value?: string | null) => string;
  theme?: 'light' | 'dark';
}) {
  if (!items || items.length === 0) return null;

  const firstItem = formatCategorySelectionLabel(items[0]);
  const displayText = items.length > 1 ? `${firstItem} +${items.length - 1}` : firstItem;
  const title = items.map(item => formatCategorySelectionLabel(item)).join(', ');

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}
      title={`${label}: ${title}`}
    >
      {displayText}
    </span>
  );
}

export default function QuestionModalPreviewPane({
  selectedQuestion,
  getOptionText,
  formatCategorySelectionLabel,
  theme = 'dark',
}: QuestionModalPreviewPaneProps) {
  if (!selectedQuestion) return null;

  return (
    <div className="space-y-4">
      <div className={`px-5 py-4 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <TopicChip
            label="Mapel"
            items={selectedQuestion.mapels || []}
            formatCategorySelectionLabel={formatCategorySelectionLabel}
            theme={theme}
          />
          <TopicChip
            label="Bab"
            items={selectedQuestion.babs || []}
            formatCategorySelectionLabel={formatCategorySelectionLabel}
            theme={theme}
          />
          <TopicChip
            label="Sub-bab"
            items={selectedQuestion.sub_babs || []}
            formatCategorySelectionLabel={formatCategorySelectionLabel}
            theme={theme}
          />
        </div>

        <RichContent html={selectedQuestion.question_text} className={`text-[15px] font-medium leading-snug ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`} />
      </div>

      {selectedQuestion.question_type === 'short_answer' ? (
        <div className={`px-4 py-3 rounded-2xl ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
          <p className={`text-[11px] font-medium mb-1.5 ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>Correct answer</p>
          <p className={`text-[13px] font-medium ${theme === 'dark' ? 'text-accent-green' : 'text-green-800'}`}>
            {selectedQuestion.short_answer || '-'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTION_LABELS.map((label) => {
            const isCorrect = selectedQuestion.correct_answer?.toLowerCase() === label;
            return (
              <div
                key={label}
                className={`px-4 py-3 rounded-2xl transition-spring-fast ${isCorrect ? (theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50') : (theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]')}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-medium uppercase ${isCorrect ? (theme === 'dark' ? 'text-accent-green/80' : 'text-green-600') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400')}`}>{label}</span>
                  {isCorrect && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${theme === 'dark' ? 'bg-accent-green/20 text-accent-green' : 'bg-green-100 text-green-700'}`}>Correct</span>
                  )}
                </div>
                <RichContent
                  html={getOptionText(selectedQuestion, label)}
                  className={`text-[13px] font-medium ${isCorrect ? (theme === 'dark' ? 'text-accent-green' : 'text-green-800') : (theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900')}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
