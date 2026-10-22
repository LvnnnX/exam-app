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
}: {
  label: string;
  items: string[];
  formatCategorySelectionLabel: (value?: string | null) => string;
}) {
  if (!items || items.length === 0) return null;

  const firstItem = formatCategorySelectionLabel(items[0]);
  const displayText = items.length > 1 ? `${firstItem} +${items.length - 1}` : firstItem;
  const title = items.map(item => formatCategorySelectionLabel(item)).join(', ');

  return (
    <span
      className="well inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold text-fg-muted"
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
}: QuestionModalPreviewPaneProps) {
  if (!selectedQuestion) return null;

  return (
    <div className="space-y-4">
      <div className="well rounded-2xl px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <TopicChip
            label="Mapel"
            items={selectedQuestion.mapels || []}
            formatCategorySelectionLabel={formatCategorySelectionLabel}
          />
          <TopicChip
            label="Bab"
            items={selectedQuestion.babs || []}
            formatCategorySelectionLabel={formatCategorySelectionLabel}
          />
          <TopicChip
            label="Sub-bab"
            items={selectedQuestion.sub_babs || []}
            formatCategorySelectionLabel={formatCategorySelectionLabel}
          />
        </div>

        <RichContent html={selectedQuestion.question_text} className="text-[15px] font-medium leading-snug text-fg" />
      </div>

      {selectedQuestion.question_type === 'short_answer' ? (
        <div className="rounded-2xl bg-primary/10 px-4 py-3">
          <p className="mb-1.5 text-[12px] font-semibold text-primary">Correct answer</p>
          <p className="text-[14px] font-medium text-fg">
            {selectedQuestion.short_answer || '-'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPTION_LABELS.map((label) => {
            const isCorrect = selectedQuestion.correct_answer?.toLowerCase() === label;
            return (
              <div
                key={label}
                className={`rounded-2xl px-4 py-3 ${isCorrect ? 'bg-primary/10 ring-1 ring-primary/30' : 'well'}`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={`text-[12px] font-bold uppercase ${isCorrect ? 'text-primary' : 'text-fg-muted'}`}>{label}</span>
                  {isCorrect && (
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Correct</span>
                  )}
                </div>
                <RichContent
                  html={getOptionText(selectedQuestion, label)}
                  className="text-[14px] font-medium text-fg"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
