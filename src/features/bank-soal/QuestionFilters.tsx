'use client';

import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import type { QuestionFilter } from './types';
import type { SubjectNode } from '@/src/features/kategori/types';

type QuestionFiltersProps = {
  filters: QuestionFilter;
  categories: SubjectNode[];
  onChange: (next: QuestionFilter) => void;
  onReset: () => void;
};

export default function QuestionFilters({
  filters,
  categories,
  onChange,
  onReset,
}: QuestionFiltersProps) {
  const selectedSubjectId = filters.subjectIds?.[0] || '';
  const selectedChapterId = filters.chapterIds?.[0] || '';
  const selectedTopicId = filters.topicIds?.[0] || '';

  const activeSubject = categories.find((s) => s.id === selectedSubjectId);
  const activeChapter = activeSubject?.chapters.find((c) => c.id === selectedChapterId);

  return (
    <div className="p-3.5 sm:p-4 rounded-3xl glass border border-line flex flex-col gap-3 text-xs sm:text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* Search text */}
        <div className="relative lg:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Cari teks soal..."
            className="w-full pl-9 pr-3 py-2 rounded-2xl well border border-line text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary text-xs"
          />
        </div>

        {/* Exact ID */}
        <div>
          <input
            type="number"
            value={filters.exactId ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              onChange({ ...filters, exactId: val, page: 1 });
            }}
            placeholder="ID Soal persis..."
            className="w-full px-3 py-2 rounded-2xl well border border-line text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary text-xs"
          />
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={filters.type || 'all'}
            onChange={(e) => onChange({ ...filters, type: e.target.value as QuestionFilter['type'], page: 1 })}
            aria-label="Filter tipe soal"
            className="w-full px-3 py-2 rounded-2xl well border border-line text-fg focus:outline-none text-xs"
          >
            <option value="all">Semua Tipe</option>
            <option value="multiple_choice">Pilihan Ganda</option>
            <option value="short_answer">Isian Singkat</option>
          </select>
        </div>

        {/* Visibility Filter */}
        <div>
          <select
            value={filters.visibility || 'all'}
            onChange={(e) => onChange({ ...filters, visibility: e.target.value as QuestionFilter['visibility'], page: 1 })}
            aria-label="Filter status visibilitas"
            className="w-full px-3 py-2 rounded-2xl well border border-line text-fg focus:outline-none text-xs"
          >
            <option value="all">Semua Status</option>
            <option value="shown">Shown (Aktif)</option>
            <option value="hidden">Hidden (Tersembunyi)</option>
          </select>
        </div>
      </div>

      {/* Cascading category dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-line/60">
        {/* Mapel */}
        <div>
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              const sid = e.target.value;
              onChange({
                ...filters,
                subjectIds: sid ? [sid] : undefined,
                chapterIds: undefined,
                topicIds: undefined,
                page: 1,
              });
            }}
            aria-label="Filter mata pelajaran"
            className="w-full px-3 py-2 rounded-2xl well border border-line text-fg focus:outline-none text-xs"
          >
            <option value="">Semua Mapel</option>
            {categories.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.question_count})</option>
            ))}
          </select>
        </div>

        {/* Bab */}
        <div>
          <select
            value={selectedChapterId}
            disabled={!activeSubject}
            onChange={(e) => {
              const cid = e.target.value;
              onChange({
                ...filters,
                chapterIds: cid ? [cid] : undefined,
                topicIds: undefined,
                page: 1,
              });
            }}
            aria-label="Filter bab"
            className="w-full px-3 py-2 rounded-2xl well border border-line text-fg focus:outline-none text-xs disabled:opacity-50"
          >
            <option value="">Semua Bab</option>
            {activeSubject?.chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.question_count})</option>
            ))}
          </select>
        </div>

        {/* Sub-bab */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTopicId}
            disabled={!activeChapter}
            onChange={(e) => {
              const tid = e.target.value;
              onChange({
                ...filters,
                topicIds: tid ? [tid] : undefined,
                page: 1,
              });
            }}
            aria-label="Filter sub-bab"
            className="w-full px-3 py-2 rounded-2xl well border border-line text-fg focus:outline-none text-xs disabled:opacity-50"
          >
            <option value="">Semua Sub-bab</option>
            {activeChapter?.topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.question_count})</option>
            ))}
          </select>

          <button
            type="button"
            onClick={onReset}
            title="Reset Semua Filter"
            aria-label="Reset semua filter"
            className="p-2 rounded-2xl well hover:bg-well-hover text-fg-muted border border-line shrink-0"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
