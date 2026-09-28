"use client";

import React from 'react';

type ConfirmIdentityStepProps = {
  userName: string;
  isSurvival: boolean;
  examMode: 'strict' | 'standard';
  mapelsLabel: string;
  babsLabel: string;
  subBabsLabel: string;
  questionCount: number;
  timeLimitLabel?: string;
  isLoading: boolean;
  onEdit: () => void;
  onStart: () => void;
};

function splitLabel(joined: string): string[] {
  if (!joined || joined === 'None') return [];
  return joined.split(',').map((s) => s.trim()).filter(Boolean);
}

function TopicChip({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="w-11 shrink-0 text-[12px] font-medium text-fg-muted">{label}</span>
        <span className="text-[14px] font-medium text-fg-subtle">None</span>
      </div>
    );
  }
  const [first, ...rest] = items;
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-11 shrink-0 text-[12px] font-medium text-fg-muted">{label}</span>
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

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-medium text-fg-muted">{label}</p>
      {children}
    </div>
  );
}

export default function ConfirmIdentityStep({
  userName,
  isSurvival,
  examMode,
  mapelsLabel,
  babsLabel,
  subBabsLabel,
  questionCount,
  timeLimitLabel,
  isLoading,
  onEdit,
  onStart,
}: ConfirmIdentityStepProps) {
  return (
    <div className="flex-1 flex flex-col px-4 pt-8 pb-12 sm:px-6 md:pt-14">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 md:mb-8">
          <p className="mb-2 text-[13px] font-medium text-fg-muted">Step 2 of 2</p>
          <h2 className="mb-2 text-[34px] font-bold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[44px]">
            Confirm identity.
          </h2>
          <p className="text-[15px] text-fg-muted">Review your details before starting.</p>
        </div>

        <div className="glass rounded-3xl p-5 md:p-6">
          <div className="mb-5 border-b border-line pb-5">
            <p className="mb-1 text-[12px] font-medium text-fg-muted">Candidate</p>
            <p className="break-words text-[22px] font-bold tracking-tight text-fg">{userName}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Detail label="Mode">
              <p className={`text-[15px] font-semibold ${isSurvival ? 'text-danger' : 'text-fg'}`}>{isSurvival ? 'Survival' : 'Exam'}</p>
            </Detail>
            {!isSurvival && (
              <Detail label="Navigation">
                <p className="text-[15px] font-semibold text-fg">
                  {examMode === 'standard' ? 'Standard' : 'Strict'}
                </p>
              </Detail>
            )}
            <div className={isSurvival ? '' : 'col-span-2'}>
              <p className="mb-2 text-[12px] font-medium text-fg-muted">Topic</p>
              <div className="well space-y-1.5 rounded-2xl px-3.5 py-3">
                <TopicChip label="Mapel" items={splitLabel(mapelsLabel)} />
                <TopicChip label="Bab" items={splitLabel(babsLabel)} />
                <TopicChip label="Sub" items={splitLabel(subBabsLabel)} />
              </div>
            </div>
            <Detail label="Questions">
              <p className="text-[15px] font-semibold tabular-nums text-fg">{isSurvival ? 'All' : questionCount}</p>
            </Detail>
            <Detail label="Time limit">
              <p className="text-[15px] font-semibold tabular-nums text-fg">{timeLimitLabel}</p>
            </Detail>
            {isSurvival && (
              <Detail label="Lives">
                <p className="text-[15px] font-semibold text-danger">3 lives</p>
              </Detail>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onEdit}
              className="well well-hover h-12 w-full rounded-xl text-[14px] font-medium text-fg transition-calm sm:flex-1"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onStart}
              disabled={isLoading}
              className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold sm:flex-1"
            >
              {isLoading ? 'Preparing…' : 'Start exam'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
