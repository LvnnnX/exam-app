"use client";

import React from 'react';

type ResultDetailsHeaderData = {
  name: string;
  mode?: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  start_time?: string;
  end_time?: string;
};

type ResultDetailsHeaderProps = {
  viewingResult: ResultDetailsHeaderData;
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

export default function ResultDetailsHeader({
  viewingResult,
  formatCategorySelectionLabel,
  onClose,
}: ResultDetailsHeaderProps) {
  const mapelChip = formatCategoryChip(viewingResult.mapel, formatCategorySelectionLabel);
  const babChip = formatCategoryChip(viewingResult.bab, formatCategorySelectionLabel);
  const subBabChip = formatCategoryChip(viewingResult.sub_bab, formatCategorySelectionLabel);

  const mapelTitle = formatCategoryTitle(viewingResult.mapel, formatCategorySelectionLabel);
  const babTitle = formatCategoryTitle(viewingResult.bab, formatCategorySelectionLabel);
  const subBabTitle = formatCategoryTitle(viewingResult.sub_bab, formatCategorySelectionLabel);

  const chip = 'well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold text-fg-muted';

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="truncate text-[18px] font-bold tracking-tight text-fg">
          {viewingResult.name}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold ${viewingResult.mode === 'survival' ? 'bg-danger/12 text-danger' : 'bg-primary/12 text-primary'}`}>
            {viewingResult.mode === 'survival' ? 'Survival' : 'Exam'}
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
          {viewingResult.start_time && viewingResult.end_time && (
            <span className={`${chip} tabular-nums`}>
              {new Date(viewingResult.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} – {new Date(viewingResult.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
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
  );
}
