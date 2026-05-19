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
  theme = 'dark',
}: ResultDetailsHeaderProps) {
  const mapelChip = formatCategoryChip(viewingResult.mapel, formatCategorySelectionLabel);
  const babChip = formatCategoryChip(viewingResult.bab, formatCategorySelectionLabel);
  const subBabChip = formatCategoryChip(viewingResult.sub_bab, formatCategorySelectionLabel);

  const mapelTitle = formatCategoryTitle(viewingResult.mapel, formatCategorySelectionLabel);
  const babTitle = formatCategoryTitle(viewingResult.bab, formatCategorySelectionLabel);
  const subBabTitle = formatCategoryTitle(viewingResult.sub_bab, formatCategorySelectionLabel);

  return (
    <div className={`shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b sm:gap-4 sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
      <div className="flex flex-col gap-2 min-w-0">
        <h2 className={`text-[15px] font-semibold tracking-tight truncate ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
          {viewingResult.name}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${viewingResult.mode === 'survival' ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700') : (theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700')}`}>
            {viewingResult.mode === 'survival' ? 'Survival' : 'Exam'}
          </span>
          {mapelChip !== '-' && (
            <span title={`Mapel: ${mapelTitle}`} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
              <span className="max-w-[140px] truncate inline-block align-bottom">{mapelChip}</span>
            </span>
          )}
          {babChip !== '-' && (
            <span title={`Bab: ${babTitle}`} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
              <span className="max-w-[140px] truncate inline-block align-bottom">{babChip}</span>
            </span>
          )}
          {subBabChip !== '-' && (
            <span title={`Sub-bab: ${subBabTitle}`} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
              <span className="max-w-[140px] truncate inline-block align-bottom">{subBabChip}</span>
            </span>
          )}
          {viewingResult.start_time && viewingResult.end_time && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-500'}`}>
              {new Date(viewingResult.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} – {new Date(viewingResult.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
