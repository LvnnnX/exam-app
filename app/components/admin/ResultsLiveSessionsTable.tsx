"use client";

import React from 'react';
import { LivesIndicator } from '@/app/components/QuestionDisplay';
import { tableHeadCell, tableRow } from '@/app/components/admin/ResultsHistoryTable';

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

type ResultsLiveSessionsTableProps = {
  liveLoading: boolean;
  liveSessions: LiveSession[];
  liveSessionPage: number;
  liveSessionItemsPerPage: number;
  activeResMapel: string[];
  activeResbab: string[];
  activeResSubBab: string[];
  activeModeFilter: string;
  formatCategorySelectionLabel: (value?: string | null) => string;
  onTrackLiveProgress: (session: LiveSession) => void;
  theme?: 'light' | 'dark';
};

function splitTopicValues(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function formatTopicChip(value: string, formatCategorySelectionLabel: (value?: string | null) => string) {
  const values = splitTopicValues(value);
  if (values.length === 0) return '-';
  const label = formatCategorySelectionLabel(values[0]);
  return values.length > 1 ? `${label} +${values.length - 1}` : label;
}

function formatTopicTitle(value: string, formatCategorySelectionLabel: (value?: string | null) => string) {
  const values = splitTopicValues(value);
  if (values.length === 0) return '-';
  return values.map((item) => formatCategorySelectionLabel(item)).join(', ');
}

function TopicChips({ mapel, bab, subBab, formatCategorySelectionLabel }: {
  mapel: string;
  bab: string;
  subBab: string;
  formatCategorySelectionLabel: (value?: string | null) => string;
}) {
  const chips = [
    { label: 'Mapel', value: formatTopicChip(mapel, formatCategorySelectionLabel), title: formatTopicTitle(mapel, formatCategorySelectionLabel) },
    { label: 'Bab', value: formatTopicChip(bab, formatCategorySelectionLabel), title: formatTopicTitle(bab, formatCategorySelectionLabel) },
    { label: 'Sub-bab', value: formatTopicChip(subBab, formatCategorySelectionLabel), title: formatTopicTitle(subBab, formatCategorySelectionLabel) },
  ].filter((chip) => chip.value !== '-');

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1" title={chips.map((chip) => `${chip.label}: ${chip.title}`).join(' | ')}>
      {chips.map((chip) => (
        <span key={chip.label} className="well max-w-[120px] truncate rounded-md px-2 py-0.5 text-[12px] font-medium text-fg-muted">
          {chip.value}
        </span>
      ))}
    </div>
  );
}

export default function ResultsLiveSessionsTable({
  liveLoading,
  liveSessions,
  liveSessionPage,
  liveSessionItemsPerPage,
  activeResMapel,
  activeResbab,
  activeResSubBab,
  activeModeFilter,
  formatCategorySelectionLabel,
  onTrackLiveProgress,
}: ResultsLiveSessionsTableProps) {
  if (liveLoading) {
    return (
      <div className="glass flex items-center justify-center gap-2 rounded-3xl py-10 text-[13px] font-medium text-fg-muted" role="status">
        <span className="spinner-calm h-4 w-4" aria-hidden="true" />
        Fetching active sessions…
      </div>
    );
  }

  if (liveSessions.length === 0) {
    return (
      <div className="glass rounded-3xl px-4 py-12 text-center">
        <p className="text-[15px] font-semibold text-fg">No active users found.</p>
        <p className="mt-1 text-[13px] text-fg-muted">Sessions appear here while students are taking an exam. Press Refresh to check again.</p>
      </div>
    );
  }

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="results-table-scroll-light min-h-0 flex-1 overflow-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className={tableHeadCell}>Name</th>
              <th className={tableHeadCell}>Mode</th>
              <th className={tableHeadCell}>Topic</th>
              <th className={tableHeadCell}>Answered</th>
              <th className={tableHeadCell}>Lives</th>
              <th className={tableHeadCell}>Progress</th>
              <th className={tableHeadCell}>Started</th>
              <th className={`${tableHeadCell} text-right`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {liveSessions
              .filter(s => (activeResMapel.length === 0 || (s.mapel && activeResMapel.includes(s.mapel))) && (activeResbab.length === 0 || (s.bab && activeResbab.includes(s.bab))) && (activeResSubBab.length === 0 || (s.sub_bab && activeResSubBab.includes(s.sub_bab))) && (activeModeFilter === 'all' || s.mode === activeModeFilter))
              .slice((liveSessionPage - 1) * liveSessionItemsPerPage, liveSessionPage * liveSessionItemsPerPage)
              .map((session) => {
                const answeredCount = Object.keys(session.user_answers).length;
                const progress = Math.round((answeredCount / session.question_count) * 100);

                return (
                  <tr key={session.session_id} className={tableRow}>
                    <td className="whitespace-nowrap px-3 py-3 text-[14px] font-semibold text-fg sm:px-5">
                      <span className="block max-w-[180px] truncate" title={session.name}>{session.name}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                      <span className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold ${session.mode === 'survival' ? 'bg-danger/12 text-danger' : 'well text-fg-muted'}`}>
                        {session.mode === 'survival' ? 'Survival' : 'Exam'}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-5">
                      <TopicChips mapel={session.mapel} bab={session.bab} subBab={session.sub_bab} formatCategorySelectionLabel={formatCategorySelectionLabel} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[14px] font-semibold tabular-nums text-fg sm:px-5">
                      {session.mode === 'survival' ? answeredCount : <span>{answeredCount}<span className="font-normal text-fg-muted">/{session.question_count}</span></span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-fg-muted sm:px-5">
                      {session.mode === 'survival' ? (
                        <LivesIndicator lives={Number(session.lives || 0)} />
                      ) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                      {session.mode === 'survival' ? (
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true"></span>
                          Ongoing
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="well h-1.5 w-24 overflow-hidden rounded-full">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-[12px] font-medium tabular-nums text-fg-muted">{progress}%</span>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] tabular-nums text-fg-muted sm:px-5">
                      {new Date(session.start_time).toLocaleTimeString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right sm:px-5">
                      <button
                        type="button"
                        onClick={() => onTrackLiveProgress(session)}
                        className="h-11 md:h-10 rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18"
                      >
                        Track
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
