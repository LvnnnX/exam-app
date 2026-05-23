"use client";

import React from 'react';
import NeumorphButton from '@/app/components/ui/neumorph-button';

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
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase">{label}</span>
        <span className="text-[13px] font-medium text-nike-grey-500 tracking-tight">None</span>
      </div>
    );
  }
  const [first, ...rest] = items;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase">{label}</span>
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
    <div className="flex-1 flex flex-col pt-10 md:pt-16 px-5 sm:px-6 pb-10">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-7 md:mb-10">
          <p className="text-[12px] font-medium text-nike-grey-500 mb-2 tracking-tight">Step 2 of 2</p>
          <h2 className="font-display text-[36px] sm:text-[48px] text-nike-black leading-[1.05] tracking-[-0.02em] mb-2">
            Confirm identity.
          </h2>
          <p className="text-[14px] text-nike-grey-500 tracking-tight">Review your details before starting.</p>
        </div>

        <div className="max-w-md w-full">
          <div className="rounded-3xl bg-black/[0.03] p-5 mb-6 space-y-5">
            <div>
              <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">Candidate</p>
              <p className="text-[20px] font-semibold text-nike-black tracking-tight">{userName}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">Mode</p>
                <p className={`text-[14px] font-semibold tracking-tight ${isSurvival ? 'text-nike-red' : 'text-nike-black'}`}>{isSurvival ? 'Survival' : 'Exam'}</p>
              </div>
              {!isSurvival && (
                <div>
                  <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">Navigation</p>
                  <p className="text-[14px] font-semibold text-nike-black tracking-tight">
                    {examMode === 'standard' ? 'Standard' : 'Strict'}
                  </p>
                </div>
              )}
              <div className={isSurvival ? '' : 'col-span-2'}>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-2 tracking-tight">Topic</p>
                <div className="space-y-1">
                  <TopicChip label="Mapel" items={splitLabel(mapelsLabel)} />
                  <TopicChip label="Bab" items={splitLabel(babsLabel)} />
                  <TopicChip label="Sub" items={splitLabel(subBabsLabel)} />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">Questions</p>
                <p className="text-[14px] font-semibold text-nike-black tabular-nums tracking-tight">{isSurvival ? 'All' : questionCount}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">Time limit</p>
                <p className="text-[14px] font-semibold text-nike-black tabular-nums tracking-tight">{timeLimitLabel}</p>
              </div>
              {isSurvival && (
                <div>
                  <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">Lives</p>
                  <p className="text-[14px] font-semibold text-nike-red tracking-tight">3 lives</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <NeumorphButton
              type="button"
              intent="secondary"
              size="medium"
              fullWidth
              onClick={onEdit}
              className="h-12 sm:flex-1"
            >
              Edit
            </NeumorphButton>
            <NeumorphButton
              type="button"
              intent="primary"
              size="medium"
              fullWidth
              loading={isLoading}
              disabled={isLoading}
              onClick={onStart}
              className="h-12 sm:flex-1"
            >
              {isLoading ? 'Preparing…' : 'Start exam'}
            </NeumorphButton>
          </div>
        </div>
      </div>
    </div>
  );
}
