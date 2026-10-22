"use client";

import React from 'react';
import { RefreshCw } from 'lucide-react';
import MultiSelectDropdown from '@/app/components/MultiSelectDropdown';

type DropdownOption = {
  value: string;
  label: string;
};

type ResultsTabControlsProps = {
  isLiveMode: boolean;
  resMapelTabs: DropdownOption[];
  resBabTabs: DropdownOption[];
  resSubBabTabs: DropdownOption[];
  activeResMapel: string[];
  activeResbab: string[];
  activeResSubBab: string[];
  activeModeFilter: string;
  onRefresh: () => void;
  onEnableLiveMode: () => void;
  onEnableHistoryMode: () => void;
  onResMapelChange: (values: string[]) => void;
  onResbabChange: (values: string[]) => void;
  onResSubBabChange: (values: string[]) => void;
  onModeFilterChange: (value: string) => void;
  theme?: 'light' | 'dark';
};

export default function ResultsTabControls({
  isLiveMode,
  resMapelTabs,
  resBabTabs,
  resSubBabTabs,
  activeResMapel,
  activeResbab,
  activeResSubBab,
  activeModeFilter,
  onRefresh,
  onEnableLiveMode,
  onEnableHistoryMode,
  onResMapelChange,
  onResbabChange,
  onResSubBabChange,
  onModeFilterChange,
  theme = 'dark',
}: ResultsTabControlsProps) {
  const segment = (active: boolean) =>
    `h-11 md:h-9 rounded-lg px-4 text-[13px] font-semibold transition-calm ${active ? 'clay' : 'text-fg-muted hover:text-fg'}`;

  return (
    <div className="glass mb-3 rounded-3xl px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[200px] flex-1">
          <h2 className="text-[22px] font-bold tracking-tight text-fg">Results</h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {isLiveMode ? 'Pantau attempt aktif dan progress peserta.' : 'Review completed attempts.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Results view">
            <button
              type="button"
              aria-pressed={isLiveMode}
              onClick={onEnableLiveMode}
              className={segment(isLiveMode)}
              title="Monitor active sessions"
            >
              Live
            </button>
            <button
              type="button"
              aria-pressed={!isLiveMode}
              onClick={onEnableHistoryMode}
              className={segment(!isLiveMode)}
              title="Review completed results"
            >
              History
            </button>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="well well-hover flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm"
          >
            <RefreshCw size={15} className="text-fg-subtle" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelectDropdown
          label="Mapel"
          options={resMapelTabs}
          selectedValues={activeResMapel}
          onChange={onResMapelChange}
          placeholder="Semua Mapel"
          theme={theme}
        />

        <MultiSelectDropdown
          label="Bab"
          options={resBabTabs}
          selectedValues={activeResbab}
          onChange={onResbabChange}
          placeholder="Semua Bab"
          theme={theme}
        />

        <MultiSelectDropdown
          label="Sub-bab"
          options={resSubBabTabs}
          selectedValues={activeResSubBab}
          onChange={onResSubBabChange}
          placeholder="Semua Sub-bab"
          theme={theme}
        />

        <div className="relative">
          <select
            value={activeModeFilter}
            onChange={(e) => onModeFilterChange(e.target.value)}
            aria-label="Mode"
            className="well well-hover h-11 w-full cursor-pointer appearance-none rounded-xl pl-3.5 pr-10 text-[14px] font-medium text-fg transition-calm"
          >
            <option value="all">Semua mode</option>
            <option value="exam">Exam</option>
            <option value="survival">Survival</option>
          </select>
          <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
