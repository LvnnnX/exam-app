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

function getSeverityBadge(avgScore: number, theme: 'light' | 'dark') {
  const wrongRate = 100 - avgScore;
  if (wrongRate > 70) {
    return {
      label: 'Critical',
      color: theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700'
    };
  } else if (wrongRate > 50) {
    return {
      label: 'High',
      color: theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange' : 'bg-orange-50 text-orange-700'
    };
  } else if (wrongRate > 25) {
    return {
      label: 'Medium',
      color: theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700'
    };
  } else {
    return {
      label: 'Low',
      color: theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700'
    };
  }
}

export default function StudentWeaknessCard({
  student,
  selected,
  onToggleSelect,
  onClick,
  formatCategoryLabel,
  theme = 'dark',
}: StudentWeaknessCardProps) {
  const severity = getSeverityBadge(student.avgScore, theme);

  // Use the pre-calculated totals from analytics data
  const totalQuestionsAnswered = student.totalQuestionsAnswered;
  const totalWrong = student.totalQuestionsWrong;

  const accuracyColor = student.avgScore > 70
    ? theme === 'dark' ? 'text-accent-green' : 'text-green-600'
    : student.avgScore > 50
    ? theme === 'dark' ? 'text-accent-orange' : 'text-orange-600'
    : theme === 'dark' ? 'text-accent-red' : 'text-red-600';

  return (
    <div
      onClick={() => onClick(student)}
      className={`rounded-2xl px-4 py-4 transition-spring-fast cursor-pointer ${
        selected
          ? theme === 'dark'
            ? 'bg-accent-blue/10 ring-1 ring-accent-blue/30'
            : 'bg-blue-50 ring-1 ring-blue-300'
          : theme === 'dark'
          ? 'bg-white/[0.03] hover:bg-white/[0.05]'
          : 'bg-black/[0.025] hover:bg-black/[0.04]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(student.key);
          }}
          className={`mt-1 h-5 w-5 cursor-pointer rounded-md transition-spring-fast flex items-center justify-center shrink-0 ${
            selected
              ? theme === 'dark'
                ? 'bg-accent-blue'
                : 'bg-blue-500'
              : theme === 'dark'
              ? 'bg-white/10 hover:bg-white/15'
              : 'bg-black/10 hover:bg-black/15'
          }`}
        >
          {selected && (
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4
                  className={`text-[14px] font-semibold tracking-tight truncate ${
                    theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
                  }`}
                >
                  {student.name}
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-tight shrink-0 ${severity.color}`}
                >
                  {severity.label}
                </span>
              </div>
              <p
                className={`text-[11px] ${
                  theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
                }`}
              >
                {totalWrong} of {totalQuestionsAnswered} wrong
              </p>
            </div>

            {/* Large Accuracy on Right */}
            <div className="text-right shrink-0">
              <div className={`text-2xl font-semibold tracking-tight tabular-nums ${accuracyColor}`}>
                {student.avgScore}%
              </div>
              <div
                className={`text-[10px] font-medium ${
                  theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'
                }`}
              >
                accuracy
              </div>
            </div>
          </div>

          {/* Multiple Weakest Topics */}
          {student.weakestTopics.length > 0 && (
            <div className="space-y-1">
              <p
                className={`text-[11px] font-medium ${
                  theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
                }`}
              >
                Weakest topics
              </p>
              {student.weakestTopics.slice(0, 3).map((topic, index) => {
                const topicColor = topic.accuracy > 70
                  ? theme === 'dark' ? 'text-accent-green' : 'text-green-600'
                  : topic.accuracy > 50
                  ? theme === 'dark' ? 'text-accent-orange' : 'text-orange-600'
                  : theme === 'dark' ? 'text-accent-red' : 'text-red-600';
                return (
                  <div
                    key={index}
                    className={`rounded-xl px-3 py-2 ${
                      theme === 'dark'
                        ? 'bg-white/[0.025]'
                        : 'bg-black/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-[12px] font-medium truncate flex-1 ${
                          theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
                        }`}
                      >
                        {formatCategoryLabel(topic.topic)}
                      </p>
                      <span className={`text-[12px] font-semibold tabular-nums shrink-0 ${topicColor}`}>
                        {topic.accuracy}%
                      </span>
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
                      }`}
                    >
                      {topic.wrong} of {topic.attempts} wrong
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
