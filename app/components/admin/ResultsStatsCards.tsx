"use client";

import React from 'react';

type StatsRow = {
  score: number;
  total_questions: number;
  duration_seconds?: number;
};

type ResultsStatsCardsProps = {
  isLiveMode: boolean;
  statsData: StatsRow[];
  theme?: 'light' | 'dark';
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export default function ResultsStatsCards({ isLiveMode, statsData, theme = 'dark' }: ResultsStatsCardsProps) {
  if (isLiveMode || statsData.length === 0) return null;

  const scoredRows = statsData.filter((row) => Number.isFinite(row.score) && Number.isFinite(row.total_questions) && row.total_questions > 0);
  const averageScore = scoredRows.length > 0 ? Math.round(scoredRows.reduce((sum, row) => sum + (row.score / row.total_questions), 0) / scoredRows.length * 100) : 0;
  const passRate = scoredRows.length > 0 ? Math.round(scoredRows.filter((row) => (row.score / row.total_questions) >= 0.7).length / scoredRows.length * 100) : 0;
  const durations = statsData.map((row) => row.duration_seconds).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const averageDuration = durations.length > 0 ? formatDuration(durations.reduce((sum, value) => sum + value, 0) / durations.length) : '-';

  const stats = [
    { value: statsData.length.toString(), label: 'Attempts', sub: 'Filtered results', accent: 'blue' as const },
    { value: `${averageScore}%`, label: 'Avg score', sub: 'Mean accuracy', accent: 'green' as const },
    { value: `${passRate}%`, label: 'Pass rate', sub: 'Score ≥ 70%', accent: 'purple' as const },
    { value: averageDuration, label: 'Avg time', sub: 'Completed only', accent: 'orange' as const },
  ];

  const accentClasses = {
    blue: theme === 'dark' ? 'text-accent-blue' : 'text-blue-600',
    green: theme === 'dark' ? 'text-accent-green' : 'text-green-600',
    purple: theme === 'dark' ? 'text-accent-purple' : 'text-indigo-600',
    orange: theme === 'dark' ? 'text-accent-orange' : 'text-orange-600',
  };

  return (
    <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
          <div className={`text-2xl font-semibold tracking-tight tabular-nums ${accentClasses[s.accent]}`}>{s.value}</div>
          <div className={`mt-0.5 text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{s.label}</div>
          <div className={`text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
