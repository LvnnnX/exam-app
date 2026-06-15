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

type StatAccent = 'blue' | 'green' | 'purple' | 'orange';

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function getStatTheme(accent: StatAccent, theme: 'light' | 'dark') {
  const dark = {
    blue: { card: 'bg-accent-blue/10', value: 'text-accent-blue' },
    green: { card: 'bg-accent-green/10', value: 'text-accent-green' },
    purple: { card: 'bg-accent-purple/10', value: 'text-accent-purple' },
    orange: { card: 'bg-accent-orange/10', value: 'text-accent-orange' },
  } satisfies Record<StatAccent, { card: string; value: string }>;

  const light = {
    blue: { card: 'bg-accent-blue-soft', value: 'text-accent-blue-soft-ink' },
    green: { card: 'bg-accent-green-soft', value: 'text-accent-green-soft-ink' },
    purple: { card: 'bg-accent-purple-soft', value: 'text-accent-purple-soft-ink' },
    orange: { card: 'bg-accent-orange-soft', value: 'text-accent-orange-soft-ink' },
  } satisfies Record<StatAccent, { card: string; value: string }>;

  return theme === 'dark' ? dark[accent] : light[accent];
}

export default function ResultsStatsCards({ isLiveMode, statsData, theme = 'dark' }: ResultsStatsCardsProps) {
  if (isLiveMode || statsData.length === 0) return null;

  const scoredRows = statsData.filter((row) => Number.isFinite(row.score) && Number.isFinite(row.total_questions) && row.total_questions > 0);
  const averageScore = scoredRows.length > 0 ? Math.round(scoredRows.reduce((sum, row) => sum + (row.score / row.total_questions), 0) / scoredRows.length * 100) : 0;
  const passRate = scoredRows.length > 0 ? Math.round(scoredRows.filter((row) => (row.score / row.total_questions) >= 0.7).length / scoredRows.length * 100) : 0;
  const durations = statsData.map((row) => row.duration_seconds).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const averageDuration = durations.length > 0 ? formatDuration(durations.reduce((sum, value) => sum + value, 0) / durations.length) : '-';

  const stats = [
    { value: statsData.length.toString(), label: 'Attempts', accent: 'blue' as const },
    { value: `${averageScore}%`, label: 'Avg score', accent: 'green' as const },
    { value: `${passRate}%`, label: 'Pass rate', accent: 'purple' as const },
    { value: averageDuration, label: 'Avg duration', accent: 'orange' as const },
  ];

  return (
    <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {stats.map((s) => {
        const statTheme = getStatTheme(s.accent, theme);
        return (
          <div key={s.label} className={`rounded-2xl px-4 py-4 ${statTheme.card}`}>
            <div className={`text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${statTheme.value}`}>
              {s.value}
            </div>
            <div className={`mt-2 text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
