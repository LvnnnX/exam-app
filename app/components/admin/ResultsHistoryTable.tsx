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

export const tableHeadCell = 'sticky top-0 z-10 border-b border-line bg-[var(--glass-solid)] px-3 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-5';
export const tableRow = 'border-b border-line transition-calm last:border-b-0 hover:bg-[var(--well-bg)]';

export default function ResultsHistoryTable({
  loading,
  results,
  formatCategorySelectionLabel,
  onViewDetails,
}: ResultsHistoryTableProps) {
  if (loading) {
    return (
      <div className="glass flex items-center justify-center gap-2 rounded-3xl py-10 text-[13px] font-medium text-fg-muted" role="status">
        <span className="spinner-calm h-4 w-4" aria-hidden="true" />
        Loading results…
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="glass rounded-3xl px-4 py-12 text-center">
        <p className="text-[15px] font-semibold text-fg">No exam results yet.</p>
        <p className="mt-1 text-[13px] text-fg-muted">Users need to complete the exam first, or loosen the filters above.</p>
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
              <th className={tableHeadCell}>Score</th>
              <th className={tableHeadCell}>Date</th>
              <th className={tableHeadCell}>Duration</th>
              <th className={`${tableHeadCell} text-right`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const ratio = result.score / Math.max(1, result.total_questions);
              const scorePill = ratio >= 0.7 ? 'bg-primary/12 text-primary'
                : ratio >= 0.5 ? 'bg-warn/15 text-highlight-fg'
                : 'bg-danger/12 text-danger';
              return (
                <tr key={result.id} className={tableRow}>
                  <td className="whitespace-nowrap px-3 py-3 text-[14px] font-semibold text-fg sm:px-5">
                    <span className="block max-w-[180px] truncate" title={result.name}>{result.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                    <span className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold ${result.mode === 'survival' ? 'bg-danger/12 text-danger' : 'well text-fg-muted'}`}>
                      {result.mode === 'survival' ? 'Survival' : 'Exam'}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    <TopicChips mapel={result.mapel} bab={result.bab} subBab={result.sub_bab} formatCategorySelectionLabel={formatCategorySelectionLabel} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold tabular-nums text-fg">{result.score}<span className="font-normal text-fg-muted">/{result.total_questions}</span></span>
                      <span className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold tabular-nums ${scorePill}`}>
                        {Math.round(ratio * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[13px] tabular-nums text-fg-muted sm:px-5">
                    {new Date(result.taken_at).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[13px] tabular-nums text-fg-muted sm:px-5">
                    {result.duration_seconds != null ? `${Math.floor(result.duration_seconds / 60)}m ${result.duration_seconds % 60}s` : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right sm:px-5">
                    <button
                      type="button"
                      onClick={() => onViewDetails(result)}
                      className="well well-hover h-11 md:h-10 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm"
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
