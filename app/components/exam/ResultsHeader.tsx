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
};

function splitLabel(joined: string): string[] {
  if (!joined || joined === 'None') return [];
  return joined.split(',').map((s) => s.trim()).filter(Boolean);
}

function TopicSegment({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-nike-grey-500/70">None</span>;
  }
  const [first, ...rest] = items;
  return (
    <span title={items.join(', ')} className="inline-flex items-baseline gap-1 min-w-0">
      <span className="truncate">{first}</span>
      {rest.length > 0 && (
        <span className="inline-flex items-center px-1.5 h-4 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums shrink-0">
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
}: ResultsHeaderProps) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const tone = isSurvival
    ? 'text-nike-black'
    : percentage >= 70
      ? 'text-nike-green'
      : percentage >= 50
        ? 'text-nike-black'
        : 'text-nike-red';

  return (
    <div className="mb-8 flex flex-col gap-5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-display text-[32px] sm:text-[40px] text-nike-black leading-[1.05] tracking-[-0.02em]">
          Performance.
        </h2>
        {startTime && endTime && (
          <span className="text-[13px] font-medium text-nike-grey-500 tabular-nums tracking-tight">{formattedDuration}</span>
        )}
      </div>

      <div className="rounded-3xl bg-black/[0.03] px-5 py-4 flex flex-col gap-3.5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-nike-grey-500/80 mb-1 tracking-tight uppercase">Kandidat</p>
            <p className="text-[18px] font-semibold text-nike-black tracking-tight truncate">{userName}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-medium text-nike-grey-500/80 mb-0.5 tracking-tight uppercase">{isSurvival ? 'Skor' : 'Nilai'}</p>
            <p className={`text-[28px] font-semibold tabular-nums tracking-tight leading-none ${tone}`}>
              {isSurvival ? score : `${percentage}%`}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-nike-grey-500 tabular-nums tracking-tight">
              {isSurvival ? `${answeredCount} terjawab` : `${score}/${total} benar`}
            </p>
          </div>
        </div>

        <div className="h-px bg-black/[0.06]" aria-hidden="true" />

        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase shrink-0">Topik</span>
          <span className="flex items-baseline gap-1.5 text-[12px] font-medium text-nike-black tracking-tight min-w-0 flex-1 flex-wrap">
            <TopicSegment items={splitLabel(mapelsLabel)} />
            <span className="text-nike-grey-500/40">·</span>
            <TopicSegment items={splitLabel(babsLabel)} />
            <span className="text-nike-grey-500/40">·</span>
            <TopicSegment items={splitLabel(subBabsLabel)} />
          </span>
        </div>

        <div className="flex items-center justify-end">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 px-3 h-6 rounded-full bg-nike-green/10 text-nike-green text-[11px] font-medium tracking-tight">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              Tersimpan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 h-6 rounded-full bg-black/5 text-nike-grey-500 text-[11px] font-medium tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-nike-grey-500 animate-pulse" />
              Menyimpan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
