"use client";

import React from 'react';

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

type ResultsHistoryTableProps = {
  loading: boolean;
  results: ExamResult[];
  totalResults: number;
  itemsPerPage: number;
  resultPage: number;
  paginationMeta: { total: number; totalPages: number } | null;
  formatCategorySelectionLabel: (value?: string | null) => string;
  onViewDetails: (result: ExamResult) => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
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

export default function ResultsHistoryTable({
  loading,
  results,
  totalResults,
  itemsPerPage,
  resultPage,
  paginationMeta,
  formatCategorySelectionLabel,
  onViewDetails,
  onPageChange,
  onItemsPerPageChange,
  theme = 'dark',
}: ResultsHistoryTableProps) {
  if (loading) {
    return <p className={`text-center py-8 text-[12px] font-medium animate-pulse ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Loading results…</p>;
  }

  if (results.length === 0) {
    return (
      <div className={`rounded-2xl px-4 py-12 text-center text-[13px] ${theme === 'dark' ? 'bg-white/[0.03] text-dark-text-tertiary' : 'bg-black/[0.025] text-gray-400'}`}>
        No exam results yet. Users need to complete the exam first.
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
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Score</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Date</th>
              <th className={`px-3 py-3 text-left text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Duration</th>
              <th className={`px-3 py-3 text-right text-[11px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}></th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const ratio = result.score / Math.max(1, result.total_questions);
              const scorePill = ratio >= 0.7 ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700')
                : ratio >= 0.5 ? (theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange' : 'bg-amber-50 text-amber-700')
                : (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700');
              return (
                <tr key={result.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}`}>
                  <td className={`px-3 py-3 whitespace-nowrap text-[13px] font-medium sm:px-5 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                    <span className="block max-w-[180px] truncate" title={result.name}>{result.name}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap sm:px-5">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${result.mode === 'survival' ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700') : (theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700')}`}>
                      {result.mode === 'survival' ? 'Survival' : 'Exam'}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    <TopicChips mapel={result.mapel} bab={result.bab} subBab={result.sub_bab} formatCategorySelectionLabel={formatCategorySelectionLabel} theme={theme} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-semibold tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{result.score}<span className={`font-normal ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>/{result.total_questions}</span></span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${scorePill}`}>
                        {Math.round(ratio * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-[12px] tabular-nums sm:px-5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                    {new Date(result.taken_at).toLocaleDateString()}
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-[12px] font-mono tabular-nums sm:px-5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                    {result.duration_seconds != null ? `${Math.floor(result.duration_seconds / 60)}m ${result.duration_seconds % 60}s` : '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right sm:px-5">
                    <button
                      onClick={() => onViewDetails(result)}
                      className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
                    >
                      View
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
