"use client";

import React from 'react';

type TrackingSessionStats = {
  current_index: number;
  question_count: number;
  user_answers: Record<string, string>;
};

type TrackingProgressStatsProps = {
  trackingSession: TrackingSessionStats;
  theme?: 'light' | 'dark';
};

export default function TrackingProgressStats({ trackingSession, theme = 'dark' }: TrackingProgressStatsProps) {
  return (
    <div className={`grid grid-cols-3 gap-2`}>
      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Index</p>
        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
          {Math.min((trackingSession.current_index || 0) + 1, trackingSession.question_count || 1)}
          <span className={`text-base font-normal ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>/{trackingSession.question_count}</span>
        </p>
      </div>
      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Answered</p>
        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{Object.keys(trackingSession.user_answers).length}</p>
      </div>
      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
        <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>Status</p>
        <p className={`text-base font-semibold tracking-tight ${theme === 'dark' ? 'text-accent-green' : 'text-green-700'} flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${theme === 'dark' ? 'bg-accent-green' : 'bg-green-500'}`}></span>
          Active
        </p>
      </div>
    </div>
  );
}
