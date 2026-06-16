"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MultiSelectDropdown from '@/app/components/MultiSelectDropdown';
import { type RawQuestion } from '@/lib/questions';
import { stripHtml } from '@/lib/rich-text';
import { normalizeCategorySlug } from '@/lib/categories';
import type { QuestionFilters } from '@/app/actions/admin/questions';

type DropdownOption = {
  value: string;
  label: string;
};

type QuestionViewMode = 'card' | 'table';

const QUESTION_VIEW_MODE_STORAGE_KEY = 'adminQuestionViewMode';
const QUESTION_PAGE_SIZES = [20, 50, 100] as const;

function getQuestionTypeLabel(question: RawQuestion) {
  return question.question_type === 'short_answer' ? 'Isian' : 'PG';
}

function getOwnerLabel(question: RawQuestion, currentAdminUserId?: string, currentAdminUsername?: string, canUpdateAnyQuestion?: boolean) {
  if (!question.created_by) return 'Unknown';
  if (currentAdminUserId && question.created_by === currentAdminUserId) return currentAdminUsername ? `@${currentAdminUsername}` : 'Mine';
  if (canUpdateAnyQuestion) {
    if (question.creator_username) return `@${question.creator_username}`;
    return `Admin (${question.created_by.substring(0, 8)})`;
  }
  return 'Unknown';
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTopicChip(values: string[] | undefined, formatCategorySelectionLabel: (value?: string | null) => string) {
  if (!values || values.length === 0) return '-';
  const label = formatCategorySelectionLabel(values[0]);
  return values.length > 1 ? `${label} +${values.length - 1}` : label;
}

function formatTopicTitle(values: string[] | undefined, formatCategorySelectionLabel: (value?: string | null) => string) {
  if (!values || values.length === 0) return '-';
  return values.map((value) => formatCategorySelectionLabel(value)).join(', ');
}

function getTopicChips(question: RawQuestion, formatCategorySelectionLabel: (value?: string | null) => string) {
  return [
    { key: 'mapel', prefix: 'M', value: formatTopicChip(question.mapels, formatCategorySelectionLabel), title: formatTopicTitle(question.mapels, formatCategorySelectionLabel) },
    { key: 'bab', prefix: 'B', value: formatTopicChip(question.babs, formatCategorySelectionLabel), title: formatTopicTitle(question.babs, formatCategorySelectionLabel) },
    { key: 'sub', prefix: 'S', value: formatTopicChip(question.sub_babs, formatCategorySelectionLabel), title: formatTopicTitle(question.sub_babs, formatCategorySelectionLabel) },
  ].filter((chip) => chip.value !== '-');
}

type QuestionBankCutoutCardProps = {
  title: string;
  count: number;
  badge: string;
  accent: 'purple' | 'blue';
  theme: 'light' | 'dark';
  onOpen: () => void;
};

function QuestionBankCutoutCard({ title, count, badge, accent, theme, onOpen }: QuestionBankCutoutCardProps) {
  const isDark = theme === 'dark';
  const accentClasses = accent === 'purple'
    ? 'bg-accent-purple text-white shadow-accent-purple/20'
    : 'bg-accent-blue text-white shadow-accent-blue/20';
  const surfaceClass = isDark
    ? 'bg-dark-800 text-dark-text-primary ring-dark-border-subtle hover:ring-dark-border-medium'
    : 'bg-white text-gray-900 ring-black/[0.06] hover:ring-black/[0.12]';
  const mutedClass = isDark ? 'text-dark-text-tertiary' : 'text-gray-500';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`group relative min-h-[190px] cursor-pointer overflow-hidden rounded-[28px] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)] ring-1 transition-spring-fast hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.22)] ${surfaceClass}`}
    >
      <div className={`absolute right-0 top-0 rounded-bl-[18px] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-md ${accentClasses}`}>
        {count} soal
        <span className={`absolute -left-[18px] top-0 h-[18px] w-[18px] rounded-tr-[18px] shadow-[6px_-6px_0_6px_currentColor] ${accent === 'purple' ? 'text-accent-purple' : 'text-accent-blue'}`} />
        <span className={`absolute -bottom-[18px] right-0 h-[18px] w-[18px] rounded-tr-[18px] shadow-[6px_-6px_0_6px_currentColor] ${accent === 'purple' ? 'text-accent-purple' : 'text-accent-blue'}`} />
      </div>

      <div className="absolute bottom-0 left-0 rounded-tr-[20px] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white bg-nike-black">
        Buka soal
        <span className="absolute -right-[20px] bottom-0 h-5 w-5 rounded-bl-[20px] shadow-[-6px_6px_0_6px_#111111]" />
        <span className="absolute -top-[20px] left-0 h-5 w-5 rounded-bl-[20px] shadow-[-6px_6px_0_6px_#111111]" />
      </div>

      <div className="flex h-full flex-col justify-between gap-8 pr-16 pb-12">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold shadow-[0_12px_30px_rgba(0,0,0,0.12)] ${accentClasses}`}>
          {badge}
        </div>
        <div>
          <h3 className="line-clamp-2 text-[20px] font-semibold tracking-[-0.04em]">{title}</h3>
          <p className={`mt-2 text-[12px] leading-relaxed ${mutedClass}`}>Kelola kumpulan soal dan filter topik.</p>
        </div>
      </div>
    </div>
  );
}

type QuestionsTabPanelProps = {
  filteredQuestions: RawQuestion[];
  questionLoading: boolean;
  mapelTabs: DropdownOption[];
  babTabs: DropdownOption[];
  subBabTabs: DropdownOption[];
  activeMapelFilter: string[];
  activebabFilter: string[];
  activeSubBabFilter: string[];
  questionTypeFilter: 'all' | 'multiple_choice' | 'short_answer';
  visibilityFilter: 'all' | 'visible' | 'hidden';
  searchQuery: string;
  sortOrder: 'asc' | 'desc';
  selectedQuestionIds: number[];
  batchProcessing: boolean;
  formatCategorySelectionLabel: (value?: string | null) => string;
  onStartAddNew: (prefilledMapel?: string | null) => void;
  showToast: (message: string, type?: 'error' | 'success' | 'info' | 'warning') => void;
  onRefreshQuestions: () => void | Promise<void>;
  onMapelFilterChange: (values: string[]) => void;
  onBabFilterChange: (values: string[]) => void;
  onSubBabFilterChange: (values: string[]) => void;
  onQuestionTypeFilterChange: (value: 'all' | 'multiple_choice' | 'short_answer') => void;
  onVisibilityFilterChange: (value: 'all' | 'visible' | 'hidden') => void;
  onSearchQueryChange: (value: string) => void;
  onToggleSortOrder: () => void;
  onToggleSelectAll: (questionIds: number[]) => void;
  onToggleQuestionSelect: (questionId: number, checked: boolean) => void;
  onOpenBatchHideConfirm: () => void;
  onOpenBatchVisibleConfirm: () => void;
  onOpenBatchDeleteConfirm: () => void;
  onViewQuestion: (question: RawQuestion) => void;
  onEditQuestion: (question: RawQuestion) => void;
  onDeleteQuestion: (question: RawQuestion) => void;
  canCreateQuestion: boolean;
  canUpdateAnyQuestion: boolean;
  canUpdateOwnQuestion: boolean;
  canDeleteAnyQuestion: boolean;
  canDeleteOwnQuestion: boolean;
  currentAdminUserId?: string;
  currentAdminUsername?: string;
  onToggleQuestionVisibility: (question: RawQuestion) => void | Promise<void>;
  onExport?: () => void;
  exporting?: boolean;
  onImport?: () => void;
  importing?: boolean;
  paginationMeta: { total: number; totalPages: number } | null;
  mapelCounts: Array<{ mapel: string; count: number }>;
  fetchQuestionsPaginated: (filters: QuestionFilters, page: number, pageSize: number) => Promise<void>;
  fetchMapelCounts: () => Promise<void>;
  theme?: 'light' | 'dark';
};

export default function QuestionsTabPanel({
  filteredQuestions,
  questionLoading,
  mapelTabs,
  babTabs,
  subBabTabs,
  activeMapelFilter,
  activebabFilter,
  activeSubBabFilter,
  questionTypeFilter,
  visibilityFilter,
  searchQuery,
  sortOrder,
  selectedQuestionIds,
  batchProcessing,
  formatCategorySelectionLabel,
  onStartAddNew,
  showToast,
  onRefreshQuestions,
  onMapelFilterChange,
  onBabFilterChange,
  onSubBabFilterChange,
  onQuestionTypeFilterChange,
  onVisibilityFilterChange,
  onSearchQueryChange,
  onToggleSortOrder,
  onToggleSelectAll,
  onToggleQuestionSelect,
  onOpenBatchHideConfirm,
  onOpenBatchVisibleConfirm,
  onOpenBatchDeleteConfirm,
  onViewQuestion,
  onEditQuestion,
  onDeleteQuestion,
  canCreateQuestion,
  canUpdateAnyQuestion,
  canUpdateOwnQuestion,
  canDeleteAnyQuestion,
  canDeleteOwnQuestion,
  currentAdminUserId,
  currentAdminUsername,
  onToggleQuestionVisibility,
  onExport,
  exporting,
  onImport,
  importing,
  paginationMeta,
  mapelCounts,
  fetchQuestionsPaginated,
  fetchMapelCounts,
  theme = 'dark',
}: QuestionsTabPanelProps) {
  const [questionViewMode, setQuestionViewMode] = useState<QuestionViewMode>(() => {
    if (typeof window === 'undefined') return 'table';
    const storedMode = window.localStorage.getItem(QUESTION_VIEW_MODE_STORAGE_KEY);
    return storedMode === 'card' || storedMode === 'table' ? storedMode : 'table';
  });
  const [questionPageSize, setQuestionPageSize] = useState<(typeof QUESTION_PAGE_SIZES)[number]>(50);
  const [questionPage, setQuestionPage] = useState(1);
  const [currentView, setCurrentView] = useState<'home' | 'filtered'>('home');
  const [selectedMapelFromHome, setSelectedMapelFromHome] = useState<string | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [isCreateMapelModalOpen, setIsCreateMapelModalOpen] = useState(false);
  const [newMapelName, setNewMapelName] = useState('');
  const [isConfirmRedirectModalOpen, setIsConfirmRedirectModalOpen] = useState(false);
  const [existingMapelInfo, setExistingMapelInfo] = useState<{label: string, slug: string} | null>(null);

  const changeQuestionViewMode = (mode: QuestionViewMode) => {
    setQuestionViewMode(mode);
    window.localStorage.setItem(QUESTION_VIEW_MODE_STORAGE_KEY, mode);
  };

  const canAccessQuestion = (question: RawQuestion) => {
    const ownsQuestion = Boolean(currentAdminUserId && question.created_by === currentAdminUserId);
    return canUpdateAnyQuestion || (ownsQuestion && canUpdateOwnQuestion);
  };
  const totalQuestionPages = paginationMeta?.totalPages || 1;
  const safeQuestionPage = Math.min(questionPage, totalQuestionPages);
  const paginatedQuestions = filteredQuestions;
  const selectableQuestions = paginatedQuestions.filter(canAccessQuestion);
  const selectedAccessibleCount = selectedQuestionIds.filter((id) => selectableQuestions.some((question) => question.id === id)).length;
  const allAccessibleSelected = selectableQuestions.length > 0 && selectedAccessibleCount === selectableQuestions.length;

  // Fetch MAPEL counts when in home view
  React.useEffect(() => {
    if (currentView === 'home') {
      void fetchMapelCounts();
    }
  }, [currentView, fetchMapelCounts]);

  // Fetch paginated questions when in filtered view
  React.useEffect(() => {
    if (currentView === 'filtered') {
      const filters = {
        mapels: activeMapelFilter,
        babs: activebabFilter,
        subBabs: activeSubBabFilter,
        questionType: questionTypeFilter,
        visibility: visibilityFilter,
        searchQuery: searchQuery,
        sortOrder: sortOrder,
      };
      void fetchQuestionsPaginated(filters, questionPage, questionPageSize);
    }
  }, [currentView, activeMapelFilter, activebabFilter, activeSubBabFilter, questionTypeFilter, visibilityFilter, searchQuery, sortOrder, questionPage, questionPageSize, fetchQuestionsPaginated]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0">
      <div className={`relative mb-4 rounded-3xl px-5 py-4 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <h2 className={`text-[20px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Bank soal</h2>
            <p className={`text-[12px] mt-0.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Kelola bank soal, filter topik, dan batch visibility.</p>
          </div>
          <div className="flex items-center gap-2">
            {currentView === 'filtered' && (
              <button
                onClick={() => {
                  setCurrentView('home');
                  setSelectedMapelFromHome(null);
                  onMapelFilterChange([]);
                }}
                className={`px-4 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
              >
                ← Home
              </button>
            )}
            {currentView === 'filtered' && (
              <button
                onClick={onRefreshQuestions}
                className={`px-4 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
              >
                Refresh
              </button>
            )}
            {currentView === 'filtered' && (
              <button
                onClick={onExport}
                disabled={exporting}
                className={`px-4 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-accent-green/15 text-accent-green hover:bg-accent-green/25' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
              >
                {exporting ? 'Exporting…' : 'Export Excel'}
              </button>
            )}
            {currentView === 'filtered' && (
              <button
                onClick={onImport}
                disabled={importing}
                className={`px-4 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
              >
                {importing ? 'Importing…' : 'Import Excel'}
              </button>
            )}
          </div>
        </div>
        {currentView === 'filtered' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canCreateQuestion && (
              <button
                onClick={() => onStartAddNew(selectedMapelFromHome)}
                className={`px-4 h-9 rounded-full text-[12px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                Add question
              </button>
            )}
            <span className={`px-3 h-9 inline-flex items-center rounded-full text-[12px] font-medium tabular-nums ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-700'}`}>
              {filteredQuestions.length} soal
            </span>
          </div>
        )}
      </div>

      {currentView === 'filtered' && (
      <>
      <div className={`mb-4 w-full rounded-3xl px-5 py-4 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          {!selectedMapelFromHome && (
            <div className="space-y-1.5">
              <span className={`block text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Mapel</span>
              <MultiSelectDropdown
                label="Mapel"
                options={mapelTabs}
                selectedValues={activeMapelFilter}
                onChange={onMapelFilterChange}
                placeholder="Semua Mapel"
                theme={theme}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <span className={`block text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Bab</span>
            <MultiSelectDropdown
              label="Bab"
              options={babTabs}
              selectedValues={activebabFilter}
              onChange={onBabFilterChange}
              placeholder="Semua Bab"
              theme={theme}
            />
          </div>
          <div className="space-y-1.5">
            <span className={`block text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Sub-bab</span>
            <MultiSelectDropdown
              label="Sub-bab"
              options={subBabTabs}
              selectedValues={activeSubBabFilter}
              onChange={onSubBabFilterChange}
              placeholder="Semua Sub-bab"
              theme={theme}
            />
          </div>
          <div className="space-y-1.5">
            <label className={`block text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Jenis soal</label>
            <select
              value={questionTypeFilter}
              onChange={(e) => onQuestionTypeFilterChange(e.target.value as 'all' | 'multiple_choice' | 'short_answer')}
              className={`h-10 w-full cursor-pointer appearance-none rounded-2xl px-4 text-[13px] font-medium transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary hover:bg-white/10' : 'bg-black/5 text-gray-900 hover:bg-black/10'}`}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
            >
              <option value="all">Semua jenis</option>
              <option value="multiple_choice">Pilihan ganda</option>
              <option value="short_answer">Isian singkat</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={`block text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Visibility</label>
            <select
              value={visibilityFilter}
              onChange={(e) => onVisibilityFilterChange(e.target.value as 'all' | 'visible' | 'hidden')}
              className={`h-10 w-full cursor-pointer appearance-none rounded-2xl px-4 text-[13px] font-medium transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary hover:bg-white/10' : 'bg-black/5 text-gray-900 hover:bg-black/10'}`}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
            >
              <option value="all">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <input
            type="text"
            placeholder={`Cari soal${filteredQuestions.length > 0 ? ` (${filteredQuestions.length})` : ''}`}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className={`h-9 w-full rounded-full px-4 pl-9 text-[12px] font-medium transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary placeholder:text-dark-text-tertiary focus:bg-white/10' : 'bg-black/5 text-gray-900 placeholder:text-gray-400 focus:bg-black/10'}`}
          />
          <svg className={`absolute left-3 top-2.5 h-4 w-4 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <button
            onClick={onToggleSortOrder}
            className={`px-3 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 whitespace-nowrap ${sortOrder === 'desc'
              ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-black/10 text-gray-900')
              : (theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10')
              }`}
          >
            {sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}
          </button>

          <div className={`inline-flex h-9 rounded-full p-0.5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
            {(['card', 'table'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => changeQuestionViewMode(mode)}
                className={`px-3 rounded-full text-[12px] font-medium transition-spring-fast ${questionViewMode === mode ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
              >
                {mode === 'card' ? 'Card' : 'Table'}
              </button>
            ))}
          </div>

          {selectableQuestions.length > 0 && (
            <button
              onClick={() => onToggleSelectAll(selectableQuestions.map((question) => question.id))}
              className={`px-3 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 whitespace-nowrap ${allAccessibleSelected
                ? (theme === 'dark' ? 'bg-accent-blue text-white' : 'bg-blue-500 text-white')
                : (theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10')
                }`}
            >
              {allAccessibleSelected ? 'Deselect' : 'Select all'}
            </button>
          )}

          {selectedAccessibleCount > 0 && (
            <>
              <button
                onClick={onOpenBatchHideConfirm}
                disabled={batchProcessing}
                className={`px-3 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 whitespace-nowrap ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                title="Hide Selected"
              >
                Hide {selectedAccessibleCount}
              </button>
              <button
                onClick={onOpenBatchVisibleConfirm}
                disabled={batchProcessing}
                className={`px-3 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 whitespace-nowrap ${theme === 'dark' ? 'bg-accent-green/15 text-accent-green hover:bg-accent-green/25' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                title="Show Selected"
              >
                Show {selectedAccessibleCount}
              </button>
              <button
                onClick={onOpenBatchDeleteConfirm}
                disabled={batchProcessing}
                className={`px-3 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 whitespace-nowrap ${theme === 'dark' ? 'bg-accent-red text-white hover:bg-accent-red/90' : 'bg-red-500 text-white hover:bg-red-600'}`}
                title="Delete Selected"
              >
                Delete {selectedAccessibleCount}
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <div className={`text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
          Showing {paginationMeta?.total === 0 ? 0 : ((safeQuestionPage - 1) * questionPageSize) + 1}-{Math.min(safeQuestionPage * questionPageSize, paginationMeta?.total || 0)} of {paginationMeta?.total || 0}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={questionPageSize}
            onChange={(event) => {
              setQuestionPageSize(Number(event.target.value) as (typeof QUESTION_PAGE_SIZES)[number]);
              setQuestionPage(1);
            }}
            className={`h-8 rounded-full px-3 text-[11px] font-medium focus:outline-none transition-spring-fast ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
          >
            {QUESTION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
          <div className={`flex h-8 overflow-hidden rounded-full ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
            <button type="button" onClick={() => setQuestionPage(Math.max(1, safeQuestionPage - 1))} disabled={safeQuestionPage === 1} className={`px-3 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>Prev</button>
            <span className={`flex items-center px-3 text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>{safeQuestionPage}/{totalQuestionPages}</span>
            <button type="button" onClick={() => setQuestionPage(Math.min(totalQuestionPages, safeQuestionPage + 1))} disabled={safeQuestionPage === totalQuestionPages} className={`px-3 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>Next</button>
          </div>
        </div>
      </div>
      </>
      )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {currentView === 'home' ? (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className={`text-[28px] md:text-[32px] font-semibold tracking-tight mb-2 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
              Pilih mata pelajaran
            </h1>
            <p className={`text-[14px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
              Kelola soal berdasarkan mata pelajaran
            </p>
          </div>

          <div className="mb-8 max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cari mata pelajaran"
                  value={homeSearchQuery}
                  onChange={(e) => setHomeSearchQuery(e.target.value)}
                  className={`h-11 w-full rounded-full px-4 pl-11 text-[13px] font-medium transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary placeholder:text-dark-text-tertiary focus:bg-white/10' : 'bg-black/5 text-gray-900 placeholder:text-gray-400 focus:bg-black/10'}`}
                />
                <svg className={`absolute left-4 top-3.5 h-4 w-4 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {homeSearchQuery && (
                  <button
                    onClick={() => setHomeSearchQuery('')}
                    className={`absolute right-3 top-3 h-5 w-5 rounded-full flex items-center justify-center transition-spring-fast active:scale-90 ${theme === 'dark' ? 'bg-white/10 text-dark-text-tertiary hover:bg-white/15' : 'bg-black/10 text-gray-500 hover:bg-black/15'}`}
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              {canCreateQuestion && (
                <button
                  onClick={() => setIsCreateMapelModalOpen(true)}
                  className={`h-11 w-11 rounded-full flex items-center justify-center text-xl font-semibold shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition-spring-fast hover:scale-[1.04] active:scale-95 ${theme === 'dark' ? 'bg-[#2f4f43] text-[#d7eadf] hover:bg-[#395e4f]' : 'bg-[#dbe8df] text-[#1f3a30] hover:bg-[#cfddD3]'}`}
                  title="Buat mapel baru"
                >
                  +
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 transition-all duration-300 ease-in-out md:grid-cols-2 lg:grid-cols-3">
            <QuestionBankCutoutCard
              title="Semua soal"
              count={mapelCounts.reduce((sum, item) => sum + item.count, 0)}
              badge="∀"
              accent="purple"
              theme={theme}
              onOpen={() => {
                setSelectedMapelFromHome(null);
                onMapelFilterChange([]);
                setCurrentView('filtered');
              }}
            />

            {mapelTabs
              .filter(mapel =>
                homeSearchQuery === '' ||
                mapel.label.toLowerCase().includes(homeSearchQuery.toLowerCase())
              )
              .map((mapel) => {
                const mapelQuestionCount = mapelCounts.find(m => m.mapel === mapel.value)?.count || 0;

                return (
                  <QuestionBankCutoutCard
                    key={mapel.value}
                    title={mapel.label}
                    count={mapelQuestionCount}
                    badge={mapel.label.charAt(0).toUpperCase()}
                    accent="blue"
                    theme={theme}
                    onOpen={() => {
                      setSelectedMapelFromHome(mapel.value);
                      onMapelFilterChange([mapel.value]);
                      setCurrentView('filtered');
                    }}
                  />
                );
              })}
          </div>
        </div>
      ) : (
      questionLoading ? (
        <div className={`rounded-2xl px-4 py-12 text-center text-[13px] ${theme === 'dark' ? 'bg-white/[0.03] text-dark-text-tertiary' : 'bg-black/[0.025] text-gray-400'}`}>Loading questions…</div>
      ) : (
        questionViewMode === 'card' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {paginatedQuestions.length === 0 && (
              <div className={`col-span-full rounded-2xl px-4 py-12 text-center text-[13px] ${theme === 'dark' ? 'bg-white/[0.03] text-dark-text-tertiary' : 'bg-black/[0.025] text-gray-400'}`}>
                No questions found for the selected topics.
              </div>
            )}

            {paginatedQuestions.map((question, index) => {
              const previewText = stripHtml(question.question_text);
              const ownsQuestion = Boolean(currentAdminUserId && question.created_by === currentAdminUserId);
              const canEditQuestion = canAccessQuestion(question);
              const canDeleteQuestion = canDeleteAnyQuestion || (ownsQuestion && canDeleteOwnQuestion);
              const ownerLabel = getOwnerLabel(question, currentAdminUserId, currentAdminUsername, canUpdateAnyQuestion);
              const updatedAtLabel = formatUpdatedAt(question.updated_at);
              const topicChips = getTopicChips(question, formatCategorySelectionLabel);

              return (
                <div key={question.id ?? index} className={`relative rounded-2xl px-5 py-4 transition-spring-fast ${theme === 'dark' ? 'bg-white/[0.03] hover:bg-white/[0.05]' : 'bg-black/[0.025] hover:bg-black/[0.04]'}`}>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className={`min-w-0 text-[13px] leading-snug ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>
                      <div className="mb-2 flex flex-wrap items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-500'}`}>#{question.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-700'}`}>{getQuestionTypeLabel(question)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700'}`}>{ownerLabel}</span>
                      </div>
                      <p className={theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}>Q{((safeQuestionPage - 1) * questionPageSize) + index + 1}: {previewText.slice(0, 96)}{previewText.length > 96 ? '…' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEditQuestion && (
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.includes(question.id)}
                          onChange={(e) => onToggleQuestionSelect(question.id, e.target.checked)}
                          className={`w-5 h-5 rounded-md cursor-pointer appearance-none ${theme === 'dark' ? 'bg-white/10 checked:bg-accent-blue' : 'bg-black/10 checked:bg-blue-500'} checked:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTMuNSA0LjVMNiAxMi4wMDEgMi41IDguNTAxIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+')] checked:bg-center checked:bg-no-repeat`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mb-12 flex flex-wrap gap-1">
                    {topicChips.length === 0 ? (
                      <span className={`text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No topic</span>
                    ) : topicChips.map((chip) => (
                      <span key={chip.key} title={chip.title} className={`px-2.5 py-1 rounded-full text-[11px] font-medium max-w-[150px] truncate ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                        {chip.value}
                      </span>
                    ))}
                  </div>
                  {updatedAtLabel && <div className={`absolute bottom-12 left-5 text-[10px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Updated: {updatedAtLabel}</div>}
                  <div className="absolute bottom-3 left-5 flex flex-wrap gap-1.5">
                    <button onClick={() => onViewQuestion(question)} className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>View</button>
                    {canEditQuestion && <button onClick={() => onEditQuestion(question)} className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange hover:bg-accent-orange/25' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>Edit</button>}
                    {canDeleteQuestion && <button type="button" onClick={() => onDeleteQuestion(question)} className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Delete</button>}
                  </div>
                  <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                    {canEditQuestion && (
                      <button type="button" onClick={() => onToggleQuestionVisibility(question)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-spring-fast ${question.is_hidden ? (theme === 'dark' ? 'bg-accent-red' : 'bg-red-400') : (theme === 'dark' ? 'bg-accent-green' : 'bg-green-400')}`} title={question.is_hidden ? 'Click to make visible' : 'Click to hide'}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${question.is_hidden ? 'translate-x-1' : 'translate-x-[18px]'}`} />
                      </button>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-tight ${question.is_hidden ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700') : (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700')}`}>
                      {question.is_hidden ? 'Hidden' : 'Visible'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-2xl ${theme === 'dark' ? 'bg-white/[0.02]' : 'bg-black/[0.015]'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full text-left">
                <thead>
                  <tr>
                    <th className={`w-12 px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}></th>
                    <th className={`w-16 px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>ID</th>
                    <th className={`w-32 px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Status</th>
                    <th className={`w-20 px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Type</th>
                    <th className={`min-w-[260px] px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Question</th>
                    <th className={`min-w-[260px] px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Topic</th>
                    <th className={`w-32 px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Owner</th>
                    <th className={`w-40 px-4 py-3 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedQuestions.length === 0 && (
                    <tr>
                      <td colSpan={8} className={`px-4 py-12 text-center text-[13px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No questions found for the selected topics.</td>
                    </tr>
                  )}
                  {paginatedQuestions.map((question) => {
                    const previewText = stripHtml(question.question_text);
                    const ownsQuestion = Boolean(currentAdminUserId && question.created_by === currentAdminUserId);
                    const canEditQuestion = canAccessQuestion(question);
                    const canDeleteQuestion = canDeleteAnyQuestion || (ownsQuestion && canDeleteOwnQuestion);
                    const ownerLabel = getOwnerLabel(question, currentAdminUserId, currentAdminUsername, canUpdateAnyQuestion);
                    const topicChips = getTopicChips(question, formatCategorySelectionLabel);

                    return (
                      <tr key={question.id} className={`align-middle transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}`}>
                        <td className="px-4 py-3">
                          {canEditQuestion && (
                            <input type="checkbox" checked={selectedQuestionIds.includes(question.id)} onChange={(e) => onToggleQuestionSelect(question.id, e.target.checked)} className={`h-4 w-4 cursor-pointer rounded-md appearance-none ${theme === 'dark' ? 'bg-white/10 checked:bg-accent-blue' : 'bg-black/10 checked:bg-blue-500'} checked:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTMuNSA0LjVMNiAxMi4wMDEgMi41IDguNTAxIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+')] checked:bg-center checked:bg-no-repeat`} />
                          )}
                        </td>
                        <td className={`px-4 py-3 text-[12px] font-medium tabular-nums ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>#{question.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {canEditQuestion && (
                              <button type="button" onClick={() => onToggleQuestionVisibility(question)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${question.is_hidden ? (theme === 'dark' ? 'bg-accent-red' : 'bg-red-400') : (theme === 'dark' ? 'bg-accent-green' : 'bg-green-400')}`} title={question.is_hidden ? 'Click to make visible' : 'Click to hide'}>
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${question.is_hidden ? 'translate-x-1' : 'translate-x-[18px]'}`} />
                              </button>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${question.is_hidden ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700') : (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700')}`}>{question.is_hidden ? 'Hidden' : 'Visible'}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{getQuestionTypeLabel(question)}</td>
                        <td className="px-4 py-3">
                          <p className={`line-clamp-2 text-[13px] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{previewText || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[320px] flex-wrap gap-1">
                            {topicChips.length === 0 ? (
                              <span className={`text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>-</span>
                            ) : topicChips.map((chip) => (
                              <span key={chip.key} title={chip.title} className={`max-w-[150px] px-2.5 py-1 rounded-full text-[11px] font-medium truncate ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                                {chip.value}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700'}`}>{ownerLabel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button onClick={() => onViewQuestion(question)} className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>View</button>
                            {canEditQuestion && <button onClick={() => onEditQuestion(question)} className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange hover:bg-accent-orange/25' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>Edit</button>}
                            {canDeleteQuestion && <button type="button" onClick={() => onDeleteQuestion(question)} className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Delete</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ))}
      </div>

      {/* Create MAPEL Modal */}
      <AnimatePresence>
      {isCreateMapelModalOpen && (
        <motion.div
          key="create-mapel-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-[#070807]/80 backdrop-blur-2xl"
          onClick={() => setIsCreateMapelModalOpen(false)}
        >
          <motion.div
            key="create-mapel-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`w-full max-w-md overflow-hidden rounded-[30px] shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${theme === 'dark' ? 'bg-[#171d1a] text-surface-mint-edge' : 'bg-[#f3f0e9] text-dark-olive-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-5 py-5 border-b sm:px-6 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
              <div>
                <p className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-[#8c9a92]' : 'text-[#73796f]'}`}>Bank soal</p>
                <h3 className={`text-[22px] font-semibold tracking-[-0.04em] ${theme === 'dark' ? 'text-[#e2e8e4]' : 'text-dark-olive-900'}`}>
                  Buat mapel baru
                </h3>
              </div>
              <button
                onClick={() => setIsCreateMapelModalOpen(false)}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newMapelName || newMapelName.trim() === '') {
                showToast('Nama MAPEL tidak boleh kosong', 'error');
                return;
              }

              const mapelSlug = normalizeCategorySlug(newMapelName);
              if (!mapelSlug) {
                showToast('Nama MAPEL tidak valid', 'error');
                return;
              }

              // Check if MAPEL already exists
              const existingMapel = mapelTabs.find(m => m.value === mapelSlug);
              if (existingMapel) {
                showToast('MAPEL sudah ada', 'warning');
                setExistingMapelInfo({ label: existingMapel.label, slug: mapelSlug });
                setIsConfirmRedirectModalOpen(true);
                return;
              }

              showToast('Anda harus membuat minimal 1 soal untuk MAPEL ini', 'info');
              setIsCreateMapelModalOpen(false);
              setNewMapelName('');
              setSelectedMapelFromHome(mapelSlug);
              onMapelFilterChange([mapelSlug]);
              setCurrentView('filtered');
              setTimeout(() => {
                onStartAddNew(mapelSlug);
              }, 100);
            }}>
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-[12px] font-medium mb-2 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                    Nama mapel
                  </label>
                  <input
                    type="text"
                    value={newMapelName}
                    onChange={(e) => setNewMapelName(e.target.value)}
                    placeholder="Contoh: Matematika, Fisika, Biologi"
                    autoFocus
                    className={`neumorph-pulse-control w-full h-12 rounded-[18px] border-0 px-4 text-[13px] font-medium shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-[#202820] text-surface-mint-edge placeholder:text-[#79867d] focus:bg-[#263028]' : 'bg-white text-dark-olive-900 placeholder:text-[#8c9288] focus:bg-white'}`}
                  />
                </div>

                <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-blue/10' : 'bg-blue-50'}`}>
                  <p className={`text-[12px] ${theme === 'dark' ? 'text-accent-blue' : 'text-blue-700'}`}>
                    Setelah membuat mapel baru, Anda harus membuat minimal 1 soal untuk mapel tersebut.
                  </p>
                </div>
              </div>

              <div className={`flex gap-2 px-4 py-3 border-t sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateMapelModalOpen(false);
                    setNewMapelName('');
                  }}
                  className={`flex-1 h-11 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`flex-1 h-11 rounded-full shadow-ios-sm font-semibold text-[13px] transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white text-nike-black hover:bg-white/90' : 'bg-nike-black text-white hover:bg-nike-black/90'}`}
                >
                  Buat mapel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Confirm Redirect Modal */}
      {isConfirmRedirectModalOpen && existingMapelInfo && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xl" onClick={() => setIsConfirmRedirectModalOpen(false)}>
          <div
            className={`w-full max-w-md rounded-[28px] shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className={`text-[15px] font-semibold tracking-tight mb-2 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                Mapel sudah ada
              </h3>
              <p className={`text-[13px] leading-relaxed mb-5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                Mapel &ldquo;{existingMapelInfo.label}&rdquo; sudah ada. Arahkan ke mapel tersebut?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmRedirectModalOpen(false);
                    setExistingMapelInfo(null);
                  }}
                  className={`flex-1 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmRedirectModalOpen(false);
                    setIsCreateMapelModalOpen(false);
                    setNewMapelName('');
                    setExistingMapelInfo(null);
                    setSelectedMapelFromHome(existingMapelInfo.slug);
                    onMapelFilterChange([existingMapelInfo.slug]);
                    setCurrentView('filtered');
                  }}
                  className={`flex-1 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-green hover:bg-accent-green/90' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  Ya, arahkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
