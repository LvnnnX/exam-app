"use client";

import React from 'react';
import ResultsTabControls from '@/app/components/admin/ResultsTabControls';
import ResultsStatsCards from '@/app/components/admin/ResultsStatsCards';
import ResultsLiveSessionsTable from '@/app/components/admin/ResultsLiveSessionsTable';
import ResultsHistoryTable from '@/app/components/admin/ResultsHistoryTable';

type DropdownOption = {
  value: string;
  label: string;
};

type StatsRow = {
  score: number;
  total_questions: number;
};

type ResultAnswer = {
  question_id: number;
  user_answer: string;
  is_correct: boolean;
};

type ExamResult = {
  id: number;
  name: string;
  score: number;
  total_questions: number;
  mapel: string;
  bab: string;
  sub_bab: string;
  taken_at: string;
  user_answers?: ResultAnswer[];
  duration_seconds?: number;
  mode?: string;
};

type LiveSession = {
  session_id: string;
  name: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  mode: string;
  question_count: number;
  question_ids: number[];
  current_index: number;
  user_answers: Record<string, string>;
  lives: number;
  start_time: string;
};

type ResultsTabPanelProps = {
  isLiveMode: boolean;
  loading: boolean;
  liveLoading: boolean;
  resMapelTabs: DropdownOption[];
  resBabTabs: DropdownOption[];
  resSubBabTabs: DropdownOption[];
  activeResMapel: string[];
  activeResbab: string[];
  activeResSubBab: string[];
  activeModeFilter: string;
  statsData: StatsRow[];
  results: ExamResult[];
  liveSessions: LiveSession[];
  totalResults: number;
  itemsPerPage: number;
  resultPage: number;
  paginationMeta: { total: number; totalPages: number } | null;
  liveSessionPage: number;
  liveSessionItemsPerPage: number;
  liveSessionPaginationMeta: { total: number; totalPages: number } | null;
  formatCategorySelectionLabel: (value?: string | null) => string;
  onRefresh: () => void;
  onEnableLiveMode: () => void;
  onEnableHistoryMode: () => void;
  onResMapelChange: (values: string[]) => void;
  onResbabChange: (values: string[]) => void;
  onResSubBabChange: (values: string[]) => void;
  onModeFilterChange: (value: string) => void;
  onTrackLiveProgress: (session: LiveSession) => void;
  onViewDetails: (result: ExamResult) => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
  onLiveSessionPageChange: (page: number) => void;
  onLiveSessionItemsPerPageChange: (size: number) => void;
  theme?: 'light' | 'dark';
};

export default function ResultsTabPanel({
  isLiveMode,
  loading,
  liveLoading,
  resMapelTabs,
  resBabTabs,
  resSubBabTabs,
  activeResMapel,
  activeResbab,
  activeResSubBab,
  activeModeFilter,
  statsData,
  results,
  liveSessions,
  totalResults,
  itemsPerPage,
  resultPage,
  paginationMeta,
  liveSessionPage,
  liveSessionItemsPerPage,
  liveSessionPaginationMeta,
  formatCategorySelectionLabel,
  onRefresh,
  onEnableLiveMode,
  onEnableHistoryMode,
  onResMapelChange,
  onResbabChange,
  onResSubBabChange,
  onModeFilterChange,
  onTrackLiveProgress,
  onViewDetails,
  onPageChange,
  onItemsPerPageChange,
  onLiveSessionPageChange,
  onLiveSessionItemsPerPageChange,
  theme = 'dark',
}: ResultsTabPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0">
      <ResultsTabControls
        isLiveMode={isLiveMode}
        resMapelTabs={resMapelTabs}
        resBabTabs={resBabTabs}
        resSubBabTabs={resSubBabTabs}
        activeResMapel={activeResMapel}
        activeResbab={activeResbab}
        activeResSubBab={activeResSubBab}
        activeModeFilter={activeModeFilter}
        onRefresh={onRefresh}
        onEnableLiveMode={onEnableLiveMode}
        onEnableHistoryMode={onEnableHistoryMode}
        onResMapelChange={onResMapelChange}
        onResbabChange={onResbabChange}
        onResSubBabChange={onResSubBabChange}
        onModeFilterChange={onModeFilterChange}
        theme={theme}
      />

      <ResultsStatsCards
        isLiveMode={isLiveMode}
        statsData={statsData}
        theme={theme}
      />
      </div>

      {!isLiveMode && paginationMeta && (
        <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[24px] border px-3 py-2 ${theme === 'dark' ? 'border-dark-600 bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
          <div className={`text-[11px] font-bold uppercase tracking-[0.1em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
            Showing {paginationMeta.total === 0 ? 0 : ((resultPage - 1) * itemsPerPage) + 1}-{Math.min(resultPage * itemsPerPage, paginationMeta.total)} of {paginationMeta.total}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={itemsPerPage}
              onChange={(event) => {
                onItemsPerPageChange(Number(event.target.value));
              }}
              className={`h-8 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.08em] focus:outline-none ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary focus:border-accent-blue' : 'border-nike-grey-300 bg-white text-nike-black focus:border-dark-800'}`}
            >
              {[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
            </select>
            <div className={`flex h-8 overflow-hidden rounded-full border ${theme === 'dark' ? 'border-dark-600 bg-dark-750' : 'border-nike-grey-300 bg-white'}`}>
              <button type="button" onClick={() => onPageChange(Math.max(1, resultPage - 1))} disabled={resultPage === 1} className={`px-3 text-[11px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Prev</button>
              <span className={`flex items-center border-x px-3 text-[11px] font-bold ${theme === 'dark' ? 'border-dark-600 text-dark-text-tertiary' : 'border-nike-grey-200 text-dark-text-muted'}`}>{resultPage}/{paginationMeta.totalPages}</span>
              <button type="button" onClick={() => onPageChange(Math.min(paginationMeta.totalPages, resultPage + 1))} disabled={resultPage === paginationMeta.totalPages} className={`px-3 text-[11px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Next</button>
            </div>
          </div>
        </div>
      )}

      {isLiveMode && liveSessionPaginationMeta && (
        <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[24px] border px-3 py-2 ${theme === 'dark' ? 'border-dark-600 bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
          <div className={`text-[11px] font-bold uppercase tracking-[0.1em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
            Showing {liveSessionPaginationMeta.total === 0 ? 0 : ((liveSessionPage - 1) * liveSessionItemsPerPage) + 1}-{Math.min(liveSessionPage * liveSessionItemsPerPage, liveSessionPaginationMeta.total)} of {liveSessionPaginationMeta.total}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={liveSessionItemsPerPage}
              onChange={(event) => {
                onLiveSessionItemsPerPageChange(Number(event.target.value));
              }}
              className={`h-8 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.08em] focus:outline-none ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary focus:border-accent-blue' : 'border-nike-grey-300 bg-white text-nike-black focus:border-dark-800'}`}
            >
              {[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
            </select>
            <div className={`flex h-8 overflow-hidden rounded-full border ${theme === 'dark' ? 'border-dark-600 bg-dark-750' : 'border-nike-grey-300 bg-white'}`}>
              <button type="button" onClick={() => onLiveSessionPageChange(Math.max(1, liveSessionPage - 1))} disabled={liveSessionPage === 1} className={`px-3 text-[11px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Prev</button>
              <span className={`flex items-center border-x px-3 text-[11px] font-bold ${theme === 'dark' ? 'border-dark-600 text-dark-text-tertiary' : 'border-nike-grey-200 text-dark-text-muted'}`}>{liveSessionPage}/{liveSessionPaginationMeta.totalPages}</span>
              <button type="button" onClick={() => onLiveSessionPageChange(Math.min(liveSessionPaginationMeta.totalPages, liveSessionPage + 1))} disabled={liveSessionPage === liveSessionPaginationMeta.totalPages} className={`px-3 text-[11px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Next</button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
      {isLiveMode ? (
        <ResultsLiveSessionsTable
          liveLoading={liveLoading}
          liveSessions={liveSessions}
          liveSessionPage={liveSessionPage}
          liveSessionItemsPerPage={liveSessionItemsPerPage}
          activeResMapel={activeResMapel}
          activeResbab={activeResbab}
          activeResSubBab={activeResSubBab}
          activeModeFilter={activeModeFilter}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          onTrackLiveProgress={onTrackLiveProgress}
          theme={theme}
        />
      ) : (
        <ResultsHistoryTable
          loading={loading}
          results={results}
          totalResults={totalResults}
          itemsPerPage={itemsPerPage}
          resultPage={resultPage}
          paginationMeta={paginationMeta}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          onViewDetails={onViewDetails}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
          theme={theme}
        />
      )}
      </div>
    </div>
  );
}
