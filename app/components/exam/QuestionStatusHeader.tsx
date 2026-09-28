"use client";

import React from 'react';

type QuestionStatusHeaderProps = {
  isSurvival: boolean;
  score: number;
  lives: number;
  userName: string;
  mapelsLabel: string;
  babsLabel: string;
  subBabsLabel: string;
  current: number;
  isStandard: boolean;
  timeLimit: number;
  expiresAt: string | null;
  timeLeftDisplay: string;
  hasAnswerSelected: boolean;
  onOpenNavPopup: () => void;
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

function isLowTime(display: string): boolean {
  const parts = display.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return false;
  const seconds = parts.reduce((acc, n) => acc * 60 + n, 0);
  return seconds > 0 && seconds < 60;
}

export default function QuestionStatusHeader({
  isSurvival,
  userName,
  mapelsLabel,
  babsLabel,
  subBabsLabel,
  isStandard,
  timeLimit,
  expiresAt,
  timeLeftDisplay,
  hasAnswerSelected,
  onOpenNavPopup,
}: QuestionStatusHeaderProps) {
  const mapelItems = splitLabel(mapelsLabel);
  const babItems = splitLabel(babsLabel);
  const subItems = splitLabel(subBabsLabel);
  const lowTime = isLowTime(timeLeftDisplay);

  return (
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words text-[17px] font-bold tracking-tight text-fg">
            {userName}
          </span>
          <span className={`inline-flex h-6 items-center rounded-lg px-2.5 text-[12px] font-semibold ${
            isSurvival ? 'bg-danger/12 text-danger' : 'well text-fg-muted'
          }`}>
            {isSurvival ? 'Survival' : 'Exam'}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-[12px] font-medium text-fg-muted">
          <TopicSegment items={mapelItems} />
          <span className="text-fg-subtle" aria-hidden="true">·</span>
          <TopicSegment items={babItems} />
          <span className="text-fg-subtle" aria-hidden="true">·</span>
          <TopicSegment items={subItems} />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {timeLimit > 0 && expiresAt && (
          <div
            className={`inline-flex h-11 items-center gap-2 rounded-xl px-3.5 ${lowTime ? 'bg-danger/12 text-danger' : 'well text-fg'}`}
            aria-label={`Sisa waktu ${timeLeftDisplay}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${lowTime ? 'bg-danger animate-pulse' : 'bg-primary'}`} aria-hidden="true" />
            <span className="text-[14px] font-bold tabular-nums">{timeLeftDisplay}</span>
          </div>
        )}

        {isStandard && (
          <button
            type="button"
            onClick={onOpenNavPopup}
            className="well well-hover flex h-11 items-center justify-center gap-2 rounded-xl px-3.5 text-fg transition-calm"
            aria-label="Daftar soal"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden text-[13px] font-semibold sm:block">Daftar soal</span>
          </button>
        )}

        {hasAnswerSelected ? (
          <span className="inline-flex h-11 items-center whitespace-nowrap rounded-xl bg-primary/12 px-3.5 text-[13px] font-semibold text-primary">
            Answer saved
          </span>
        ) : (
          <span className="well inline-flex h-11 items-center whitespace-nowrap rounded-xl px-3.5 text-[13px] font-medium text-fg-muted">
            Pending
          </span>
        )}
      </div>
    </div>
  );
}
