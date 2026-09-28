"use client";

import React from 'react';
import { LivesIndicator } from '@/app/components/QuestionDisplay';

type TrackingSessionHeaderData = {
  name: string;
  mode: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  start_time: string;
  question_count: number;
  current_index: number;
  lives?: number;
};

type TrackingModalHeaderProps = {
  trackingSession: TrackingSessionHeaderData;
  formatCategorySelectionLabel: (value?: string | null) => string;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

function splitCategoryValues(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function formatCategoryChip(value: string, formatCategorySelectionLabel: (value?: string | null) => string) {
  const values = splitCategoryValues(value);
  if (values.length === 0) return '-';
  const label = formatCategorySelectionLabel(values[0]);
  return values.length > 1 ? `${label} +${values.length - 1}` : label;
}

function formatCategoryTitle(value: string, formatCategorySelectionLabel: (value?: string | null) => string) {
  const values = splitCategoryValues(value);
  if (values.length === 0) return '-';
  return values.map(item => formatCategorySelectionLabel(item)).join(', ');
}

export default function TrackingModalHeader({
  trackingSession,
  formatCategorySelectionLabel,
  onClose,
}: TrackingModalHeaderProps) {
  const mapelChip = formatCategoryChip(trackingSession.mapel, formatCategorySelectionLabel);
  const babChip = formatCategoryChip(trackingSession.bab, formatCategorySelectionLabel);
  const subBabChip = formatCategoryChip(trackingSession.sub_bab, formatCategorySelectionLabel);

  const mapelTitle = formatCategoryTitle(trackingSession.mapel, formatCategorySelectionLabel);
  const babTitle = formatCategoryTitle(trackingSession.bab, formatCategorySelectionLabel);
  const subBabTitle = formatCategoryTitle(trackingSession.sub_bab, formatCategorySelectionLabel);

  const chip = 'well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold text-fg-muted';
  const progress = Math.round(((trackingSession.current_index + 1) / trackingSession.question_count) * 100);

  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Live" />
          <h2 className="truncate text-[18px] font-bold tracking-tight text-fg">
            {trackingSession.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold ${trackingSession.mode === 'survival' ? 'bg-danger/12 text-danger' : 'bg-primary/12 text-primary'}`}>
          {trackingSession.mode === 'survival' ? 'Survival' : 'Exam'}
        </span>
        {mapelChip !== '-' && (
          <span title={`Mapel: ${mapelTitle}`} className={chip}>
            <span className="inline-block max-w-[140px] truncate align-bottom">{mapelChip}</span>
          </span>
        )}
        {babChip !== '-' && (
          <span title={`Bab: ${babTitle}`} className={chip}>
            <span className="inline-block max-w-[140px] truncate align-bottom">{babChip}</span>
          </span>
        )}
        {subBabChip !== '-' && (
          <span title={`Sub-bab: ${subBabTitle}`} className={chip}>
            <span className="inline-block max-w-[140px] truncate align-bottom">{subBabChip}</span>
          </span>
        )}
        <span className={`${chip} tabular-nums`}>
          {new Date(trackingSession.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="clay inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-[13px] font-bold tabular-nums">
          {trackingSession.current_index + 1}/{trackingSession.question_count}
        </span>
        <div className="well h-2 flex-1 overflow-hidden rounded-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[13px] font-semibold tabular-nums text-fg-muted">{progress}%</span>
        {trackingSession.mode === 'survival' && trackingSession.lives != null && (
          <LivesIndicator lives={trackingSession.lives} />
        )}
      </div>
    </div>
  );
}
