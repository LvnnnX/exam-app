"use client";

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { accuracyTone } from '@/app/components/admin/StudentWeaknessCard';

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

type StudentWeaknessModalProps = {
  student: StudentWeakness;
  onClose: () => void;
  formatCategoryLabel: (value: string) => string;
  theme?: 'light' | 'dark';
};

export default function StudentWeaknessModal({
  student,
  onClose,
  formatCategoryLabel,
  theme = 'dark',
}: StudentWeaknessModalProps) {
  // Use the pre-calculated totals from analytics data
  const totalQuestionsAnswered = student.totalQuestionsAnswered;
  const totalWrong = student.totalQuestionsWrong;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-theme={theme}
      className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-weakness-modal-title"
      onClick={onClose}
    >
      <div
        className="glass-sheet animate-in flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-4xl sm:max-h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-fg-muted">
              Student weakness
            </p>
            <h3 id="student-weakness-modal-title" className="mt-0.5 truncate text-[18px] font-bold tracking-tight text-fg">
              {student.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="clay rounded-2xl px-4 py-3">
              <div className="text-[24px] font-bold tracking-tight tabular-nums text-danger">
                {totalWrong}
              </div>
              <div className="text-[12px] font-medium text-fg-muted">
                Total wrong
              </div>
            </div>
            <div className="clay rounded-2xl px-4 py-3">
              <div className="text-[24px] font-bold tracking-tight tabular-nums text-fg">
                {totalQuestionsAnswered}
              </div>
              <div className="text-[12px] font-medium text-fg-muted">
                Answered
              </div>
            </div>
            <div className="clay rounded-2xl px-4 py-3">
              <div className={`text-[24px] font-bold tracking-tight tabular-nums ${accuracyTone(student.avgScore)}`}>
                {student.avgScore}%
              </div>
              <div className="text-[12px] font-medium text-fg-muted">
                Avg score
              </div>
            </div>
          </div>

          {/* Weak Topics List */}
          <div>
            <h4 className="mb-3 text-[13px] font-semibold text-fg-muted">
              Weak topics · {student.weakestTopics.length}
            </h4>
            {student.weakestTopics.length === 0 ? (
              <p className="well rounded-2xl px-4 py-6 text-center text-[13px] text-fg-muted">
                No weak topic recorded for this student yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {student.weakestTopics.map((topic, index) => (
                  <div key={index} className="well rounded-2xl px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-fg">
                          {formatCategoryLabel(topic.topic)}
                        </p>
                        <p className="text-[12px] text-fg-muted">
                          {topic.wrong} of {topic.attempts} wrong
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <span className={`text-[16px] font-bold tabular-nums ${accuracyTone(topic.accuracy)}`}>
                          {topic.accuracy}%
                        </span>
                        <span className="text-[11px] font-medium text-fg-muted">
                          accuracy
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
