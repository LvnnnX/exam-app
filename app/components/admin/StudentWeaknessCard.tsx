"use client";

import React from 'react';

type StudentWeaknessTopic = {
  topic: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracy: number;
};

type StudentWeakness = {
  key: string;
  name: string;
  attempts: number;
  avgScore: number;
  totalQuestionsAnswered: number;
  totalQuestionsWrong: number;
  weakestTopics: StudentWeaknessTopic[];
};

type StudentWeaknessCardProps = {
  student: StudentWeakness;
  selected: boolean;
  onToggleSelect: (key: string) => void;
  onClick: (student: StudentWeakness) => void;
  formatCategoryLabel: (value: string) => string;
  theme?: 'light' | 'dark';
};

export function getSeverityBadge(avgScore: number) {
  const wrongRate = 100 - avgScore;
  if (wrongRate > 70) return { label: 'Critical', color: 'bg-danger/12 text-danger' };
  if (wrongRate > 50) return { label: 'High', color: 'bg-warn/15 text-highlight-fg' };
  if (wrongRate > 25) return { label: 'Medium', color: 'well text-fg-muted' };
  return { label: 'Low', color: 'bg-primary/12 text-primary' };
}

export function accuracyTone(accuracy: number) {
  if (accuracy > 70) return 'text-primary';
  if (accuracy > 50) return 'text-highlight-fg';
  return 'text-danger';
}

export default function StudentWeaknessCard({
  student,
  selected,
  onToggleSelect,
  onClick,
  formatCategoryLabel,
}: StudentWeaknessCardProps) {
  const severity = getSeverityBadge(student.avgScore);

  // Use the pre-calculated totals from analytics data
  const totalQuestionsAnswered = student.totalQuestionsAnswered;
  const totalWrong = student.totalQuestionsWrong;

  return (
    <div className={`glass-sheet flex items-start gap-1 rounded-3xl py-2 pl-1 pr-2 transition-calm ${selected ? 'ring-2 ring-primary/50' : ''}`}>
      <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          aria-label={`Select ${student.name}`}
          checked={selected}
          onChange={() => onToggleSelect(student.key)}
          className="h-5 w-5 cursor-pointer accent-[var(--primary)]"
        />
      </label>

      <button
        type="button"
        onClick={() => onClick(student)}
        className="well-hover min-w-0 flex-1 rounded-2xl px-2 py-2 text-left transition-calm"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h4 className="truncate text-[15px] font-bold tracking-tight text-fg">
                {student.name}
              </h4>
              <span className={`inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[11px] font-semibold ${severity.color}`}>
                {severity.label}
              </span>
            </div>
            <p className="text-[12px] text-fg-muted">
              {totalWrong} of {totalQuestionsAnswered} wrong
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className={`text-[24px] font-bold leading-tight tracking-tight tabular-nums ${accuracyTone(student.avgScore)}`}>
              {student.avgScore}%
            </div>
            <div className="text-[11px] font-medium text-fg-muted">
              accuracy
            </div>
          </div>
        </div>

        {student.weakestTopics.length > 0 && (
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-fg-muted">
              Weakest topics
            </p>
            {student.weakestTopics.slice(0, 3).map((topic, index) => (
              <div key={index} className="well rounded-xl px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex-1 truncate text-[13px] font-medium text-fg">
                    {formatCategoryLabel(topic.topic)}
                  </p>
                  <span className={`shrink-0 text-[13px] font-bold tabular-nums ${accuracyTone(topic.accuracy)}`}>
                    {topic.accuracy}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  {topic.wrong} of {topic.attempts} wrong
                </p>
              </div>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
