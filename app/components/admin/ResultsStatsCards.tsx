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
    blue: {
      card: 'bg-[radial-gradient(circle_at_50%_0%,rgba(72,145,217,0.22),rgba(72,145,217,0.07)_44%,rgba(10,14,18,0.96)_100%)] ring-[#2b4a63]/50 shadow-[0_18px_44px_rgba(20,62,101,0.24)]',
      value: 'text-[#55a9ff]',
    },
    green: {
      card: 'bg-[radial-gradient(circle_at_50%_0%,rgba(74,163,117,0.22),rgba(74,163,117,0.07)_44%,rgba(10,16,13,0.96)_100%)] ring-[#2f5b46]/50 shadow-[0_18px_44px_rgba(29,86,57,0.22)]',
      value: 'text-[#5fd091]',
    },
    purple: {
      card: 'bg-[radial-gradient(circle_at_50%_0%,rgba(168,111,255,0.22),rgba(168,111,255,0.07)_44%,rgba(15,11,19,0.96)_100%)] ring-[#4b356f]/50 shadow-[0_18px_44px_rgba(88,42,139,0.22)]',
      value: 'text-[#b579ff]',
    },
    orange: {
      card: 'bg-[radial-gradient(circle_at_50%_0%,rgba(255,151,79,0.22),rgba(255,151,79,0.07)_44%,rgba(19,13,8,0.96)_100%)] ring-[#6f432b]/50 shadow-[0_18px_44px_rgba(134,75,31,0.22)]',
      value: 'text-[#ff9d57]',
    },
  } satisfies Record<StatAccent, { card: string; value: string }>;

  const light = {
    blue: { card: 'bg-blue-50 ring-blue-100 shadow-[0_14px_34px_rgba(37,99,235,0.10)]', value: 'text-blue-600' },
    green: { card: 'bg-green-50 ring-green-100 shadow-[0_14px_34px_rgba(22,163,74,0.10)]', value: 'text-green-600' },
    purple: { card: 'bg-purple-50 ring-purple-100 shadow-[0_14px_34px_rgba(124,58,237,0.10)]', value: 'text-purple-600' },
    orange: { card: 'bg-orange-50 ring-orange-100 shadow-[0_14px_34px_rgba(234,88,12,0.10)]', value: 'text-orange-600' },
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
          <div
            key={s.label}
            className={`relative overflow-hidden rounded-2xl px-4 py-4 ring-1 ${statTheme.card}`}
          >
            <div className="absolute inset-x-4 top-0 h-px bg-white/15" />
            <div className={`text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${statTheme.value}`}>
              {s.value}
            </div>
            <div className={`mt-2 text-[12px] font-medium ${theme === 'dark' ? 'text-[#d9e0dc]/75' : 'text-gray-700'}`}>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
