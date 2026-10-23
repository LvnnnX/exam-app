"use client";

import React from 'react';

type ScoreStepViewProps = {
  isSurvival: boolean;
  score: number;
  total: number;
  mapelsLabel: string;
  babsLabel: string;
  subBabsLabel: string;
  saving: boolean;
  saved: boolean;
  saveFailed: boolean;
  onViewBreakdown: () => void;
};

function splitLabel(joined: string): string[] {
  if (!joined || joined === 'None') return [];
  return joined.split(',').map((s) => s.trim()).filter(Boolean);
}

function TopicChip({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="w-11 shrink-0 text-left text-[12px] font-medium text-fg-muted">{label}</span>
        <span className="text-[14px] font-medium text-fg-subtle">None</span>
      </div>
    );
  }
  const [first, ...rest] = items;
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-11 shrink-0 text-left text-[12px] font-medium text-fg-muted">{label}</span>
      <span className="truncate text-[14px] font-semibold text-fg">{first}</span>
      {rest.length > 0 && (
        <span
          title={items.join(', ')}
          className="well inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums text-fg-muted"
        >
          +{rest.length}
        </span>
      )}
    </div>
  );
}

export default function ScoreStepView({
  isSurvival,
  score,
  total,
  mapelsLabel,
  babsLabel,
  subBabsLabel,
  saving,
  saved,
  saveFailed,
  onViewBreakdown,
}: ScoreStepViewProps) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const tone = isSurvival
    ? 'text-fg'
    : percentage >= 70
      ? 'text-primary'
      : percentage >= 50
        ? 'text-fg'
        : 'text-danger';
  const ringColor = isSurvival
    ? 'var(--fg-muted)'
    : percentage >= 70
      ? 'var(--primary)'
      : percentage >= 50
        ? 'var(--fg-muted)'
        : 'var(--danger)';
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const ringProgress = isSurvival ? 1 : Math.min(1, Math.max(0, percentage / 100));

  return (
    <div className="flex-1 flex flex-col px-4 pt-8 pb-12 sm:px-6 md:pt-14">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <p className="mb-5 text-[13px] font-medium text-fg-muted">
            {isSurvival ? 'Survival selesai' : 'Ujian selesai'}
          </p>

          <div className="clay relative flex h-48 w-48 items-center justify-center rounded-full sm:h-52 sm:w-52">
            <svg className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] -rotate-90" viewBox="0 0 184 184" aria-hidden="true">
              <circle cx="92" cy="92" r={radius} fill="none" stroke="var(--line)" strokeWidth="6" />
              <circle
                cx="92"
                cy="92"
                r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - ringProgress)}
                style={{ transition: 'stroke-dashoffset 320ms var(--ease-calm)' }}
              />
            </svg>
            <div className="relative flex flex-col items-center">
              <span className={`text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[52px] ${tone}`}>
                {isSurvival ? score : `${percentage}%`}
              </span>
              <span className="mt-1.5 text-[13px] font-medium text-fg-muted">
                {isSurvival ? 'Skor akhir' : `${score} dari ${total} benar`}
              </span>
            </div>
          </div>

          {isSurvival && (
            <p className="mt-4 text-[13px] font-medium tabular-nums text-fg-muted">
              {total} soal terjawab
            </p>
          )}
        </div>

        <div className="glass mb-4 rounded-3xl px-5 py-4">
          <p className="mb-2.5 text-[12px] font-medium text-fg-muted">Topik</p>
          <div className="space-y-1.5">
            <TopicChip label="Mapel" items={splitLabel(mapelsLabel)} />
            <TopicChip label="Bab" items={splitLabel(babsLabel)} />
            <TopicChip label="Sub" items={splitLabel(subBabsLabel)} />
          </div>
        </div>

        <div className="mb-5 flex h-8 items-center justify-center" role="status" aria-live="polite">
          {saving && (
            <span className="well inline-flex h-7 items-center gap-2 rounded-lg px-3 text-[12px] font-medium text-fg-muted">
              <span className="spinner-calm h-3 w-3" aria-hidden="true" />
              Menyimpan…
            </span>
          )}
          {saved && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-primary/12 px-3 text-[12px] font-semibold text-primary">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
              Tersimpan
            </span>
          )}
          {saveFailed && (
            <span className="inline-flex h-7 items-center rounded-lg bg-danger/12 px-3 text-[12px] font-semibold text-danger">
              Gagal menyimpan
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onViewBreakdown}
          className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold"
        >
          Lihat ringkasan
        </button>
      </div>
    </div>
  );
}
