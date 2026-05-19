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

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-2xl z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[95vh] sm:max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[24px] sm:rounded-[28px] shadow-ios-xl flex flex-col ${
          theme === 'dark' ? 'bg-dark-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
          <div className="min-w-0">
            <p
              className={`text-[11px] font-medium ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              Student weakness
            </p>
            <h3
              className={`mt-0.5 text-[15px] font-semibold tracking-tight truncate ${
                theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
              }`}
            >
              {student.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 sm:px-6 sm:py-6 sm:space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-red/10' : 'bg-red-50'}`}>
              <div className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-accent-red' : 'text-red-700'}`}>
                {totalWrong}
              </div>
              <div className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-red/80' : 'text-red-600'}`}>
                Total wrong
              </div>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
              <div className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                {totalQuestionsAnswered}
              </div>
              <div className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                Answered
              </div>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${student.avgScore > 70 ? (theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50') : student.avgScore > 50 ? (theme === 'dark' ? 'bg-accent-orange/10' : 'bg-orange-50') : (theme === 'dark' ? 'bg-accent-red/10' : 'bg-red-50')}`}>
              <div className={`text-2xl font-semibold tracking-tight tabular-nums ${student.avgScore > 70 ? (theme === 'dark' ? 'text-accent-green' : 'text-green-700') : student.avgScore > 50 ? (theme === 'dark' ? 'text-accent-orange' : 'text-orange-700') : (theme === 'dark' ? 'text-accent-red' : 'text-red-700')}`}>
                {student.avgScore}%
              </div>
              <div className={`text-[11px] font-medium ${student.avgScore > 70 ? (theme === 'dark' ? 'text-accent-green/80' : 'text-green-600') : student.avgScore > 50 ? (theme === 'dark' ? 'text-accent-orange/80' : 'text-orange-600') : (theme === 'dark' ? 'text-accent-red/80' : 'text-red-600')}`}>
                Avg score
              </div>
            </div>
          </div>

          {/* Weak Topics List */}
          <div>
            <h4 className={`mb-3 text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
              Weak topics · {student.weakestTopics.length}
            </h4>
            <div className="space-y-1.5">
              {student.weakestTopics.map((topic, index) => (
                <div
                  key={index}
                  className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                        {formatCategoryLabel(topic.topic)}
                      </p>
                      <p className={`text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                        {topic.wrong} of {topic.attempts} wrong
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span
                        className={`text-base font-semibold tabular-nums ${
                          topic.accuracy > 70
                            ? theme === 'dark' ? 'text-accent-green' : 'text-green-600'
                            : topic.accuracy > 50
                            ? theme === 'dark' ? 'text-accent-orange' : 'text-orange-600'
                            : theme === 'dark' ? 'text-accent-red' : 'text-red-600'
                        }`}
                      >
                        {topic.accuracy}%
                      </span>
                      <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
                        accuracy
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
