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

function PageBar({
  page,
  perPage,
  total,
  totalPages,
  onPageChange,
  onPerPageChange,
}: {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (size: number) => void;
}) {
  const navButton = 'well well-hover h-11 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="glass mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2">
      <div className="px-1 text-[13px] font-medium tabular-nums text-fg-muted">
        Showing {total === 0 ? 0 : ((page - 1) * perPage) + 1}-{Math.min(page * perPage, total)} of {total}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={perPage}
          onChange={(event) => {
            onPerPageChange(Number(event.target.value));
          }}
          aria-label="Rows per page"
          className="well well-hover h-11 cursor-pointer rounded-xl px-3 text-[13px] font-medium text-fg transition-calm"
        >
          {[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
        </select>
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className={navButton}>Prev</button>
        <span className="px-1 text-[13px] font-semibold tabular-nums text-fg-muted">{page}/{totalPages}</span>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={navButton}>Next</button>
      </div>
    </div>
  );
}

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
        <PageBar
          page={resultPage}
          perPage={itemsPerPage}
          total={paginationMeta.total}
          totalPages={paginationMeta.totalPages}
          onPageChange={onPageChange}
          onPerPageChange={onItemsPerPageChange}
        />
      )}

      {isLiveMode && liveSessionPaginationMeta && (
        <PageBar
          page={liveSessionPage}
          perPage={liveSessionItemsPerPage}
          total={liveSessionPaginationMeta.total}
          totalPages={liveSessionPaginationMeta.totalPages}
          onPageChange={onLiveSessionPageChange}
          onPerPageChange={onLiveSessionItemsPerPageChange}
        />
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
