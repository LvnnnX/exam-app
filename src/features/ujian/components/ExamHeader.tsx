'use client';

import React from 'react';
import { formatClock } from '../logic';
import type { SaveStatus } from '../hooks/useUjianSession';
import { ChipList, topicsSummary } from './ui';
import type { TopicLabels } from '../types';

interface ExamHeaderProps {
  name: string;
  topics: TopicLabels;
  index: number;
  total: number;
  seconds: number | null;
  saveStatus: SaveStatus;
  onSurrender: () => void;
  onOpenNav?: () => void;
  isStandard?: boolean;
}

const SAVE_LABEL: Record<SaveStatus, string | null> = {
  idle: null,
  saving: 'Menyimpan...',
  saved: 'Tersimpan',
  retry_1: 'Mencoba lagi (1/2)...',
  retry_2: 'Mencoba lagi (2/2)...',
  error: 'Gagal menyimpan',
};

export default function ExamHeader(props: ExamHeaderProps) {
  const { name, topics, index, total, seconds, saveStatus, onSurrender, onOpenNav, isStandard } = props;
  const lowTime = seconds !== null && seconds < 60;
  const saveText = SAVE_LABEL[saveStatus];

  return (
    <header className="glass flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="clay inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-bold tabular-nums text-fg">
            Soal {index + 1}/{total}
          </span>
          <span className="truncate text-[13px] font-medium text-fg" title={name}>
            {name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {seconds !== null && (
            <span
              data-testid="ujian-timer"
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold tabular-nums ${
                lowTime ? 'bg-danger/15 text-danger' : 'well text-fg'
              }`}
            >
              {lowTime && <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />}
              {formatClock(seconds)}
            </span>
          )}

          <button
            type="button"
            data-testid="ujian-surrender"
            onClick={onSurrender}
            className="transition-calm inline-flex h-8 items-center rounded-lg px-3 text-[12px] font-semibold text-danger hover:bg-danger/10"
          >
            Menyerah
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-[12px] text-fg-muted">
        <div className="min-w-0 flex-1">
          <ChipList items={topicsSummary(topics)} max={2} />
        </div>

        <div className="flex items-center gap-2">
          {saveText && (
            <span
              data-testid="ujian-save-status"
              role="status"
              aria-live="polite"
              className={`text-[12px] font-medium ${saveStatus === 'error' ? 'text-danger' : 'text-fg-muted'}`}
            >
              {saveText}
            </span>
          )}

          {isStandard && onOpenNav && (
            <button
              type="button"
              onClick={onOpenNav}
              className="well well-hover transition-calm inline-flex h-8 items-center rounded-lg px-3 text-[12px] font-semibold text-fg"
            >
              Daftar soal
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
