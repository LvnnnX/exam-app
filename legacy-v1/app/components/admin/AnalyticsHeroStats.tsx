"use client";

import React from 'react';

type AnalyticsSummary = {
  attempts: number;
  avgScore: number;
  passRate: number;
  avgDurationSeconds: number | null;
};

type AnalyticsHeroStatsProps = {
  summary: AnalyticsSummary;
  theme?: 'light' | 'dark';
};

function formatDuration(seconds: number | null) {
  if (seconds == null) return '-';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export default function AnalyticsHeroStats({
  summary,
  theme = 'dark',
}: AnalyticsHeroStatsProps) {
  const stats = [
    { value: summary.attempts.toLocaleString(), label: 'Attempts', description: 'Total exam and quiz attempts in the selected scope.' },
    { value: `${summary.avgScore}%`, label: 'Avg score', description: 'Average score across all attempts.' },
    { value: `${summary.passRate}%`, label: 'Pass rate', description: 'Share of attempts that passed.' },
    { value: formatDuration(summary.avgDurationSeconds), label: 'Avg duration', description: 'Average time taken to complete.' },
  ];

  return (
    <div data-theme={theme} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          title={stat.description}
          className="clay rounded-3xl px-5 py-4"
        >
          <p className="text-[28px] font-bold leading-tight tracking-tight tabular-nums text-fg">
            {stat.value}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-fg">
            {stat.label}
          </p>
          <p className="mt-0.5 hidden text-[12px] leading-snug text-fg-muted sm:block">
            {stat.description}
          </p>
        </div>
      ))}
    </div>
  );
}
