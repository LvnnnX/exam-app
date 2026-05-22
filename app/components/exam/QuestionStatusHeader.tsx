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
    return <span className="text-nike-grey-500/70">None</span>;
  }
  const [first, ...rest] = items;
  return (
    <span title={items.join(', ')} className="inline-flex items-baseline gap-1">
      <span className="truncate">{first}</span>
      {rest.length > 0 && (
        <span className="inline-flex items-center px-1.5 h-4 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums shrink-0">
          +{rest.length}
        </span>
      )}
    </span>
  );
}

export default function QuestionStatusHeader({
  isSurvival,
  score: _score,
  lives: _lives,
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

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-col min-w-0 gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[16px] font-semibold text-nike-black tracking-tight break-words">
              {userName}
            </span>
            <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[11px] font-medium tracking-tight ${
              isSurvival ? 'bg-nike-red/10 text-nike-red' : 'bg-black/5 text-nike-grey-500'
            }`}>
              {isSurvival ? 'Survival' : 'Exam'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 text-[11px] font-medium text-nike-grey-500 tracking-tight min-w-0 flex-wrap">
            <TopicSegment items={mapelItems} />
            <span className="text-nike-grey-500/40">·</span>
            <TopicSegment items={babItems} />
            <span className="text-nike-grey-500/40">·</span>
            <TopicSegment items={subItems} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {timeLimit > 0 && expiresAt && (
            <div className="inline-flex items-center gap-2 bg-black/5 px-3 h-9 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-nike-red animate-pulse"></span>
              <span className="text-[12px] font-semibold tabular-nums font-mono text-nike-black">{timeLeftDisplay}</span>
            </div>
          )}

          {isStandard && (
            <button
              onClick={onOpenNavPopup}
              className="h-9 px-3 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center gap-2 transition-spring-fast active:scale-95"
              title="Daftar Soal"
            >
              <svg className="w-4 h-4 text-nike-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-[12px] font-medium text-nike-black hidden sm:block tracking-tight">Daftar soal</span>
            </button>
          )}

          {hasAnswerSelected ? (
            <span className="inline-flex items-center px-3 h-9 rounded-full bg-nike-green/10 text-nike-green text-[11px] font-medium tracking-tight whitespace-nowrap">
              Answer saved
            </span>
          ) : (
            <span className="inline-flex items-center px-3 h-9 rounded-full bg-black/5 text-nike-grey-500 text-[11px] font-medium tracking-tight whitespace-nowrap">
              Pending
            </span>
          )}
        </div>
      </div>
    </>
  );
}
