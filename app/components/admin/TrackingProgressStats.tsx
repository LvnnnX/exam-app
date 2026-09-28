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

export default function TrackingProgressStats({ trackingSession }: TrackingProgressStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div className="clay rounded-2xl px-4 py-3">
        <p className="text-[12px] font-medium text-fg-muted">Index</p>
        <p className="text-[24px] font-bold tabular-nums tracking-tight text-fg">
          {Math.min((trackingSession.current_index || 0) + 1, trackingSession.question_count || 1)}
          <span className="text-[15px] font-medium text-fg-muted">/{trackingSession.question_count}</span>
        </p>
      </div>
      <div className="clay rounded-2xl px-4 py-3">
        <p className="text-[12px] font-medium text-fg-muted">Answered</p>
        <p className="text-[24px] font-bold tabular-nums tracking-tight text-fg">{Object.keys(trackingSession.user_answers).length}</p>
      </div>
      <div className="clay rounded-2xl px-4 py-3">
        <p className="text-[12px] font-medium text-fg-muted">Status</p>
        <p className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true"></span>
          Active
        </p>
      </div>
    </div>
  );
}
