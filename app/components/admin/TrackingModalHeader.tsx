"use client";

import React from 'react';

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
  theme = 'dark',
}: TrackingModalHeaderProps) {
  const mapelChip = formatCategoryChip(trackingSession.mapel, formatCategorySelectionLabel);
  const babChip = formatCategoryChip(trackingSession.bab, formatCategorySelectionLabel);
  const subBabChip = formatCategoryChip(trackingSession.sub_bab, formatCategorySelectionLabel);

  const mapelTitle = formatCategoryTitle(trackingSession.mapel, formatCategorySelectionLabel);
  const babTitle = formatCategoryTitle(trackingSession.bab, formatCategorySelectionLabel);
  const subBabTitle = formatCategoryTitle(trackingSession.sub_bab, formatCategorySelectionLabel);

  return (
    <div className={`shrink-0 flex flex-col gap-3 px-4 py-3 border-b sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <h2 className={`text-[15px] font-semibold tracking-tight truncate ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
            {trackingSession.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${trackingSession.mode === 'survival' ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700') : (theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700')}`}>
          {trackingSession.mode === 'survival' ? 'Survival' : 'Exam'}
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
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-500'}`}>
          {new Date(trackingSession.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Progress Stats Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700'}`}>
          {trackingSession.current_index + 1}/{trackingSession.question_count}
        </span>
        {trackingSession.mode === 'survival' && trackingSession.lives != null && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700'}`}>
            <span>♥</span>
            {trackingSession.lives}
          </span>
        )}
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-accent-purple/15 text-accent-purple' : 'bg-purple-50 text-purple-700'}`}>
          {Math.round(((trackingSession.current_index + 1) / trackingSession.question_count) * 100)}%
        </span>
      </div>
    </div>
  );
}
