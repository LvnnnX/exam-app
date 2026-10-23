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
    { value: statsData.length.toString(), label: 'Attempts', sub: 'Filtered results' },
    { value: `${averageScore}%`, label: 'Avg score', sub: 'Mean accuracy' },
    { value: `${passRate}%`, label: 'Pass rate', sub: 'Score ≥ 70%' },
    { value: averageDuration, label: 'Avg time', sub: 'Completed only' },
  ];

  return (
    <div data-theme={theme} className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="clay rounded-3xl px-4 py-3.5">
          <div className="text-[26px] font-bold leading-tight tracking-tight tabular-nums text-fg">{s.value}</div>
          <div className="mt-0.5 text-[13px] font-semibold text-fg">{s.label}</div>
          <div className="text-[12px] text-fg-muted">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
