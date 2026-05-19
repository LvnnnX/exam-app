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
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
        <span className="text-[13px] font-medium text-nike-grey-500 tracking-tight">None</span>
      </div>
    );
  }
  const [first, ...rest] = items;
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
      <span className="text-[13px] font-medium text-nike-black tracking-tight truncate">{first}</span>
      {rest.length > 0 && (
        <span
          title={items.join(', ')}
          className="inline-flex items-center px-1.5 h-5 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums tracking-tight shrink-0"
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
    ? 'text-nike-black'
    : percentage >= 70
      ? 'text-nike-green'
      : percentage >= 50
        ? 'text-nike-black'
        : 'text-nike-red';

  return (
    <div className="flex-1 flex flex-col pt-10 md:pt-16 px-5 sm:px-6 pb-10">
      <div className="max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <p className="text-[11px] font-medium text-nike-grey-500 mb-3 tracking-tight uppercase">
            {isSurvival ? 'Survival selesai' : 'Ujian selesai'}
          </p>

          {isSurvival ? (
            <>
              <h2 className={`font-display text-[64px] sm:text-[80px] leading-[1] tracking-[-0.03em] tabular-nums ${tone}`}>
                {score}
              </h2>
              <p className="mt-1 text-[13px] font-semibold text-nike-black tracking-tight">
                Skor akhir
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-nike-grey-500 tracking-tight tabular-nums">
                {total} soal terjawab
              </p>
            </>
          ) : (
            <>
              <h2 className={`font-display text-[64px] sm:text-[80px] leading-[1] tracking-[-0.03em] tabular-nums ${tone}`}>
                {percentage}%
              </h2>
              <p className="mt-2 text-[13px] font-medium text-nike-grey-500 tracking-tight">
                {score} dari {total} benar
              </p>
            </>
          )}
        </div>

        <div className="rounded-3xl bg-black/[0.03] px-5 py-4 mb-4">
          <p className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase mb-2.5">Topik</p>
          <div className="space-y-1.5">
            <TopicChip label="Mapel" items={splitLabel(mapelsLabel)} />
            <TopicChip label="Bab" items={splitLabel(babsLabel)} />
            <TopicChip label="Sub" items={splitLabel(subBabsLabel)} />
          </div>
        </div>

        <div className="flex items-center justify-center mb-5 h-7">
          {saving && (
            <span className="inline-flex items-center gap-1.5 px-3 h-6 rounded-full bg-black/5 text-nike-grey-500 text-[11px] font-medium tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-nike-grey-500 animate-pulse" />
              Menyimpan…
            </span>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1.5 px-3 h-6 rounded-full bg-nike-green/10 text-nike-green text-[11px] font-medium tracking-tight">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              Tersimpan
            </span>
          )}
          {saveFailed && (
            <span className="inline-flex items-center gap-1.5 px-3 h-6 rounded-full bg-nike-red/10 text-nike-red text-[11px] font-medium tracking-tight">
              Gagal menyimpan
            </span>
          )}
        </div>

        <button
          onClick={onViewBreakdown}
          className="w-full h-12 rounded-full bg-nike-black text-white text-[14px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] tracking-tight shadow-ios-sm"
        >
          Lihat ringkasan
        </button>
      </div>
    </div>
  );
}

