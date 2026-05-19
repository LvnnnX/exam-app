"use client";

import React from 'react';
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
  return (
    <div className={`mb-4 rounded-3xl px-5 py-4 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <h2 className={`text-[20px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Results</h2>
          <p className={`text-[12px] mt-0.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
            {isLiveMode ? 'Pantau attempt aktif dan progress peserta.' : 'Review completed attempts.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className={`px-4 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className={`inline-flex h-9 rounded-full p-0.5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
          <button
            type="button"
            onClick={onEnableLiveMode}
            className={`px-4 rounded-full text-[12px] font-medium transition-spring-fast ${isLiveMode ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            title="Monitor active sessions"
          >
            Live
          </button>
          <button
            type="button"
            onClick={onEnableHistoryMode}
            className={`px-4 rounded-full text-[12px] font-medium transition-spring-fast ${!isLiveMode ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            title="Review completed results"
          >
            History
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="min-w-[180px] flex-1">
          <MultiSelectDropdown
            label="Mapel"
            options={resMapelTabs}
            selectedValues={activeResMapel}
            onChange={onResMapelChange}
            placeholder="Semua Mapel"
            theme={theme}
          />
        </div>

        <div className="min-w-[180px] flex-1">
          <MultiSelectDropdown
            label="Bab"
            options={resBabTabs}
            selectedValues={activeResbab}
            onChange={onResbabChange}
            placeholder="Semua Bab"
            theme={theme}
          />
        </div>

        <div className="min-w-[180px] flex-1">
          <MultiSelectDropdown
            label="Sub-bab"
            options={resSubBabTabs}
            selectedValues={activeResSubBab}
            onChange={onResSubBabChange}
            placeholder="Semua Sub-bab"
            theme={theme}
          />
        </div>

        <select
          value={activeModeFilter}
          onChange={(e) => onModeFilterChange(e.target.value)}
          className={`h-11 min-w-[150px] cursor-pointer rounded-2xl px-4 text-[13px] font-medium transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary hover:bg-white/10' : 'bg-black/5 text-gray-900 hover:bg-black/10'}`}
        >
          <option value="all">Semua mode</option>
          <option value="exam">Exam</option>
          <option value="survival">Survival</option>
        </select>
      </div>
    </div>
  );
}
