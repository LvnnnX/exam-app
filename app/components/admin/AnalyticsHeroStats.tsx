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
    {
      value: summary.attempts.toLocaleString(),
      label: 'Attempts',
      tooltip: 'Total number of exam/quiz attempts in the selected scope',
      color: theme === 'dark' ? 'text-accent-blue' : 'text-blue-600',
      bgColor: theme === 'dark' ? 'bg-accent-blue/10' : 'bg-blue-50',
      borderColor: theme === 'dark' ? 'border-accent-blue/20' : 'border-blue-200',
    },
    {
      value: `${summary.avgScore}%`,
      label: 'Avg Score',
      tooltip: 'Average score across all attempts',
      color: theme === 'dark' ? 'text-accent-green' : 'text-green-600',
      bgColor: theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50',
      borderColor: theme === 'dark' ? 'border-accent-green/20' : 'border-green-200',
    },
    {
      value: `${summary.passRate}%`,
      label: 'Pass Rate',
      tooltip: 'Percentage of attempts that passed',
      color: theme === 'dark' ? 'text-accent-purple' : 'text-purple-600',
      bgColor: theme === 'dark' ? 'bg-accent-purple/10' : 'bg-purple-50',
      borderColor: theme === 'dark' ? 'border-accent-purple/20' : 'border-purple-200',
    },
    {
      value: formatDuration(summary.avgDurationSeconds),
      label: 'Avg Duration',
      tooltip: 'Average time taken to complete',
      color: theme === 'dark' ? 'text-accent-orange' : 'text-orange-600',
      bgColor: theme === 'dark' ? 'bg-accent-orange/10' : 'bg-orange-50',
      borderColor: theme === 'dark' ? 'border-accent-orange/20' : 'border-orange-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          title={stat.tooltip}
          className={`rounded-2xl px-5 py-4 cursor-help transition-spring-fast ${stat.bgColor}`}
        >
          <p className={`text-3xl font-semibold tracking-tight tabular-nums ${stat.color}`}>
            {stat.value}
          </p>
          <p
            className={`mt-1 text-[12px] font-medium ${
              theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'
            }`}
          >
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
