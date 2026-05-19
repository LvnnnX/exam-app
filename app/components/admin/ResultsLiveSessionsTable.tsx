"use client";

import React from 'react';

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

function TopicChips({ mapel, bab, subBab, formatCategorySelectionLabel, theme = 'dark' }: {
  mapel: string;
  bab: string;
  subBab: string;
  formatCategorySelectionLabel: (value?: string | null) => string;
  theme?: 'light' | 'dark';
}) {
  const chips = [
    { label: 'Mapel', value: formatTopicChip(mapel, formatCategorySelectionLabel), title: formatTopicTitle(mapel, formatCategorySelectionLabel) },
    { label: 'Bab', value: formatTopicChip(bab, formatCategorySelectionLabel), title: formatTopicTitle(bab, formatCategorySelectionLabel) },
    { label: 'Sub-bab', value: formatTopicChip(subBab, formatCategorySelectionLabel), title: formatTopicTitle(subBab, formatCategorySelectionLabel) },
  ].filter((chip) => chip.value !== '-');

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1" title={chips.map((chip) => `${chip.label}: ${chip.title}`).join(' | ')}>
      {chips.map((chip) => (
        <span key={chip.label} className={`max-w-[120px] px-2.5 py-1 rounded-full text-[11px] font-medium truncate ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
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
  theme = 'dark',
}: ResultsLiveSessionsTableProps) {
  if (liveLoading) {
    return <p className={`text-center py-8 text-[12px] font-medium animate-pulse ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Fetching active sessions…</p>;
  }

  if (liveSessions.length === 0) {
    return (
      <div className={`rounded-2xl px-4 py-12 text-center text-[13px] ${theme === 'dark' ? 'bg-white/[0.03] text-dark-text-tertiary' : 'bg-black/[0.025] text-gray-400'}`}>
        No active users found. Real-time tracking is empty.
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl ${theme === 'dark' ? 'bg-white/[0.02]' : 'bg-black/[0.015]'}`}>
      <div className={`min-h-0 flex-1 overflow-auto ${theme === 'dark' ? 'results-table-scroll-dark' : 'results-table-scroll-light'}`}>
        <table className="min-w-full">
          <thead>
            <tr>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Name</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Mode</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Topic</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Answered</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Lives</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Progress</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Started</th>
              <th className={`px-3 py-3 text-right text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}></th>
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
                  <tr key={session.session_id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}`}>
                    <td className={`px-3 py-3 whitespace-nowrap text-[13px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                      <span className="block max-w-[180px] truncate" title={session.name}>{session.name}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap sm:px-5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${session.mode === 'survival' ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700') : (theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700')}`}>
                        {session.mode === 'survival' ? 'Survival' : 'Exam'}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-5">
                      <TopicChips mapel={session.mapel} bab={session.bab} subBab={session.sub_bab} formatCategorySelectionLabel={formatCategorySelectionLabel} theme={theme} />
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-[13px] font-semibold tabular-nums sm:px-5 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                      {session.mode === 'survival' ? answeredCount : <span>{answeredCount}<span className={`font-normal ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>/{session.question_count}</span></span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-[12px] sm:px-5">
                      {session.mode === 'survival' ? (
                        <div className="flex gap-0.5">
                          {Array.from({ length: Number(session.lives || 0) }).map((_, i) => (
                            <span key={i} className={theme === 'dark' ? 'text-accent-red' : 'text-red-500'}>♥</span>
                          ))}
                          {Array.from({ length: Math.max(0, 3 - Number(session.lives || 0)) }).map((_, i) => (
                            <span key={i} className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-300'}>♡</span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap sm:px-5">
                      {session.mode === 'survival' ? (
                        <span className={`flex items-center gap-1.5 text-[11px] font-medium ${theme === 'dark' ? 'text-accent-green' : 'text-green-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${theme === 'dark' ? 'bg-accent-green' : 'bg-green-500'}`}></span>
                          Ongoing
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className={`w-24 h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
                            <div className={`h-full transition-all ${theme === 'dark' ? 'bg-accent-blue' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className={`text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>{progress}%</span>
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-[12px] tabular-nums font-mono sm:px-5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                      {new Date(session.start_time).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right sm:px-5">
                      <button
                        onClick={() => onTrackLiveProgress(session)}
                        className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
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
