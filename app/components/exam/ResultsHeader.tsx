"use client";

import React from 'react';

type ResultsHeaderProps = {
  startTime: number | null;
  endTime: number | null;
  formattedDuration: string;
  userName: string;
  isSurvival: boolean;
  answeredCount: number;
  score: number;
  total: number;
  mapelsLabel: string;
  babsLabel: string;
  subBabsLabel: string;
  saved: boolean;
  isScheduledExam?: boolean;
  scheduledExamTitle?: string;
};

function splitLabel(joined: string): string[] {
  if (!joined || joined === 'None') return [];
  return joined.split(',').map((s) => s.trim()).filter(Boolean);
}

function TopicSegment({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-fg-subtle">None</span>;
  }
  const [first, ...rest] = items;
  return (
    <span title={items.join(', ')} className="inline-flex min-w-0 items-baseline gap-1">
      <span className="truncate">{first}</span>
      {rest.length > 0 && (
        <span className="well inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums text-fg-muted">
          +{rest.length}
        </span>
      )}
    </span>
  );
}

export default function ResultsHeader({
  startTime,
  endTime,
  formattedDuration,
  userName,
  isSurvival,
  answeredCount,
  score,
  total,
  mapelsLabel,
  babsLabel,
  subBabsLabel,
  saved,
  isScheduledExam,
  scheduledExamTitle,
}: ResultsHeaderProps) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const tone = isSurvival
    ? 'text-fg'
    : percentage >= 70
      ? 'text-primary'
      : percentage >= 50
        ? 'text-fg'
        : 'text-danger';

  return (
    <div className="mb-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[40px]">
          Performance.
        </h2>
        {startTime && endTime && (
          <span className="text-[14px] font-medium tabular-nums text-fg-muted">{formattedDuration}</span>
        )}
      </div>

      <div className="glass flex flex-col gap-4 rounded-3xl px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-[12px] font-medium text-fg-muted">Kandidat</p>
            <p className="truncate text-[19px] font-bold tracking-tight text-fg">{userName}</p>
          </div>
          <div className="clay shrink-0 rounded-2xl px-4 py-3 text-right">
            <p className="mb-0.5 text-[12px] font-medium text-fg-muted">{isSurvival ? 'Skor' : 'Nilai'}</p>
            <p className={`text-[28px] font-bold leading-none tabular-nums tracking-tight ${tone}`}>
              {isSurvival ? score : `${percentage}%`}
            </p>
            <p className="mt-1 text-[12px] font-medium tabular-nums text-fg-muted">
              {isSurvival ? `${answeredCount} terjawab` : `${score}/${total} benar`}
            </p>
          </div>
        </div>

        <div className="h-px bg-line" aria-hidden="true" />

        {isScheduledExam && scheduledExamTitle && (
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="shrink-0 text-[12px] font-medium text-fg-muted">Nama ujian</span>
            <span className="truncate text-[13px] font-semibold text-fg">{scheduledExamTitle}</span>
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="shrink-0 text-[12px] font-medium text-fg-muted">Topik</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 text-[13px] font-semibold text-fg">
            <TopicSegment items={splitLabel(mapelsLabel)} />
            <span className="text-fg-subtle" aria-hidden="true">·</span>
            <TopicSegment items={splitLabel(babsLabel)} />
            <span className="text-fg-subtle" aria-hidden="true">·</span>
            <TopicSegment items={splitLabel(subBabsLabel)} />
          </span>
        </div>

        <div className="flex items-center justify-end" role="status" aria-live="polite">
          {saved ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-primary/12 px-3 text-[12px] font-semibold text-primary">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
              Tersimpan
            </span>
          ) : (
            <span className="well inline-flex h-7 items-center gap-2 rounded-lg px-3 text-[12px] font-medium text-fg-muted">
              <span className="spinner-calm h-3 w-3" aria-hidden="true" />
              Menyimpan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
