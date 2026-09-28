"use client";

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Download, Library, Plus, RefreshCw, Search, Upload, X } from 'lucide-react';
import MultiSelectDropdown from '@/app/components/MultiSelectDropdown';
import type { QuestionFilters } from '@/app/actions/admin/questions';
import { scrimMotion, sheetMotion } from '@/app/components/ui/motion-presets';
import { type RawQuestion } from '@/lib/questions';
import { stripHtml } from '@/lib/rich-text';
import { normalizeCategorySlug } from '@/lib/categories';

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

const secondaryButton = 'well well-hover flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm disabled:cursor-not-allowed disabled:opacity-40';
const rowAction = 'h-11 md:h-10 rounded-xl px-3.5 text-[13px] font-semibold transition-calm';
const topicChipClass = 'well max-w-[150px] truncate rounded-md px-2 py-0.5 text-[12px] font-medium text-fg-muted';
const selectClass = 'well well-hover h-11 w-full cursor-pointer appearance-none rounded-xl pl-3.5 pr-10 text-[14px] font-medium text-fg transition-calm';

function SelectChevron() {
  return (
    <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function VisibilitySwitch({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!hidden}
      aria-label={hidden ? 'Hidden. Click to make visible' : 'Visible. Click to hide'}
      onClick={onToggle}
      title={hidden ? 'Click to make visible' : 'Click to hide'}
      className="flex h-11 items-center"
    >
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-calm ${hidden ? 'bg-line-strong' : 'bg-primary'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${hidden ? 'translate-x-1' : 'translate-x-6'}`} />
      </span>
    </button>
  );
}

function VisibilityChip({ hidden }: { hidden: boolean }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold ${hidden ? 'bg-danger/12 text-danger' : 'bg-primary/12 text-primary'}`}>
      {hidden ? 'Hidden' : 'Visible'}
    </span>
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
  paginationMeta: { total: number; totalPages: number } | null;
  mapelCounts: Array<{ mapel: string; count: number }>;
  onExport?: () => void;
  exporting?: boolean;
  onImport?: () => void;
  importing?: boolean;
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
  paginationMeta,
  mapelCounts,
  onExport,
  exporting,
  onImport,
  importing,
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

  const openMapel = (mapelValue: string | null) => {
    setSelectedMapelFromHome(mapelValue);
    onMapelFilterChange(mapelValue ? [mapelValue] : []);
    setCurrentView('filtered');
  };

  const closeCreateMapelModal = () => {
    setIsCreateMapelModalOpen(false);
    setNewMapelName('');
  };

  React.useEffect(() => {
    if (!isCreateMapelModalOpen && !isConfirmRedirectModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isConfirmRedirectModalOpen) {
        setIsConfirmRedirectModalOpen(false);
        setExistingMapelInfo(null);
      } else {
        setIsCreateMapelModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateMapelModalOpen, isConfirmRedirectModalOpen]);

  const totalQuestionsAcrossMapels = mapelCounts.reduce((sum, item) => sum + item.count, 0);
  const visibleMapels = mapelTabs.filter(mapel =>
    homeSearchQuery === '' ||
    mapel.label.toLowerCase().includes(homeSearchQuery.toLowerCase())
  );

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0">
      <div className="glass relative mb-3 rounded-3xl px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[200px] flex-1">
            <h2 className="text-[22px] font-bold tracking-tight text-fg">Bank soal</h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">Kelola bank soal, filter topik, dan batch visibility.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentView === 'filtered' && (
              <button
                type="button"
                onClick={() => {
                  setCurrentView('home');
                  setSelectedMapelFromHome(null);
                  onMapelFilterChange([]);
                }}
                className={secondaryButton}
              >
                <ArrowLeft size={15} className="text-fg-subtle" />
                Home
              </button>
            )}
            {currentView === 'filtered' && (
              <button type="button" onClick={onRefreshQuestions} className={secondaryButton}>
                <RefreshCw size={15} className="text-fg-subtle" />
                Refresh
              </button>
            )}
            {currentView === 'filtered' && onExport && (
              <button type="button" onClick={onExport} disabled={exporting} className={secondaryButton}>
                {exporting ? <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" /> : <Download size={15} className="text-fg-subtle" />}
                {exporting ? 'Exporting…' : 'Export Excel'}
              </button>
            )}
            {currentView === 'filtered' && onImport && (
              <button type="button" onClick={onImport} disabled={importing} className={secondaryButton}>
                {importing ? <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" /> : <Upload size={15} className="text-fg-subtle" />}
                {importing ? 'Importing…' : 'Import Excel'}
              </button>
            )}
            {currentView === 'filtered' && canCreateQuestion && (
              <button
                type="button"
                onClick={() => onStartAddNew(selectedMapelFromHome)}
                className="clay-primary flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold"
              >
                <Plus size={16} />
                Add question
              </button>
            )}
          </div>
        </div>
        {currentView === 'filtered' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="clay inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-bold tabular-nums">
              {filteredQuestions.length} soal
            </span>
          </div>
        )}
      </div>

      {currentView === 'filtered' && (
      <>
      <div className="glass mb-3 w-full rounded-3xl px-4 py-4 sm:px-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          {!selectedMapelFromHome && (
            <div className="space-y-1.5">
              <span className="block text-[12px] font-medium text-fg-muted">Mapel</span>
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
            <span className="block text-[12px] font-medium text-fg-muted">Bab</span>
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
            <span className="block text-[12px] font-medium text-fg-muted">Sub-bab</span>
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
            <label htmlFor="question-type-filter" className="block text-[12px] font-medium text-fg-muted">Jenis soal</label>
            <div className="relative">
              <select
                id="question-type-filter"
                value={questionTypeFilter}
                onChange={(e) => onQuestionTypeFilterChange(e.target.value as 'all' | 'multiple_choice' | 'short_answer')}
                className={selectClass}
              >
                <option value="all">Semua jenis</option>
                <option value="multiple_choice">Pilihan ganda</option>
                <option value="short_answer">Isian singkat</option>
              </select>
              <SelectChevron />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="question-visibility-filter" className="block text-[12px] font-medium text-fg-muted">Visibility</label>
            <div className="relative">
              <select
                id="question-visibility-filter"
                value={visibilityFilter}
                onChange={(e) => onVisibilityFilterChange(e.target.value as 'all' | 'visible' | 'hidden')}
                className={selectClass}
              >
                <option value="all">All</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <input
              type="text"
              aria-label="Cari soal"
              placeholder={`Cari soal${filteredQuestions.length > 0 ? ` (${filteredQuestions.length})` : ''}`}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="well h-11 w-full rounded-xl pl-10 pr-4 text-[14px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
            />
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleSortOrder}
              className={`${secondaryButton} whitespace-nowrap`}
              aria-label={`Sort: ${sortOrder === 'desc' ? 'newest first' : 'oldest first'}`}
            >
              {sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}
            </button>

            <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="View mode">
              {(['card', 'table'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={questionViewMode === mode}
                  onClick={() => changeQuestionViewMode(mode)}
                  className={`h-11 md:h-9 rounded-lg px-3.5 text-[13px] font-semibold transition-calm ${questionViewMode === mode ? 'clay' : 'text-fg-muted hover:text-fg'}`}
                >
                  {mode === 'card' ? 'Card' : 'Table'}
                </button>
              ))}
            </div>

            {selectableQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => onToggleSelectAll(selectableQuestions.map((question) => question.id))}
                className={allAccessibleSelected
                  ? 'h-11 whitespace-nowrap rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18'
                  : `${secondaryButton} whitespace-nowrap`}
              >
                {allAccessibleSelected ? 'Deselect' : 'Select all'}
              </button>
            )}

            {selectedAccessibleCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={onOpenBatchHideConfirm}
                  disabled={batchProcessing}
                  className={`${secondaryButton} whitespace-nowrap font-semibold`}
                  title="Hide selected"
                >
                  Hide {selectedAccessibleCount}
                </button>
                <button
                  type="button"
                  onClick={onOpenBatchVisibleConfirm}
                  disabled={batchProcessing}
                  className="h-11 whitespace-nowrap rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18 disabled:opacity-50"
                  title="Show selected"
                >
                  Show {selectedAccessibleCount}
                </button>
                <button
                  type="button"
                  onClick={onOpenBatchDeleteConfirm}
                  disabled={batchProcessing}
                  className="h-11 whitespace-nowrap rounded-xl bg-danger/10 px-4 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15 disabled:opacity-50"
                  title="Delete selected"
                >
                  Delete {selectedAccessibleCount}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="glass mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2">
        <div className="px-1 text-[13px] font-medium tabular-nums text-fg-muted">
          Showing {paginationMeta?.total === 0 ? 0 : ((safeQuestionPage - 1) * questionPageSize) + 1}-{Math.min(safeQuestionPage * questionPageSize, paginationMeta?.total || 0)} of {paginationMeta?.total || 0}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={questionPageSize}
            aria-label="Rows per page"
            onChange={(event) => {
              setQuestionPageSize(Number(event.target.value) as (typeof QUESTION_PAGE_SIZES)[number]);
              setQuestionPage(1);
            }}
            className="well well-hover h-11 cursor-pointer rounded-xl px-3 text-[13px] font-medium text-fg transition-calm"
          >
            {QUESTION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
          <button type="button" onClick={() => setQuestionPage(Math.max(1, safeQuestionPage - 1))} disabled={safeQuestionPage === 1} className={secondaryButton}>Prev</button>
          <span className="px-1 text-[13px] font-semibold tabular-nums text-fg-muted">{safeQuestionPage}/{totalQuestionPages}</span>
          <button type="button" onClick={() => setQuestionPage(Math.min(totalQuestionPages, safeQuestionPage + 1))} disabled={safeQuestionPage === totalQuestionPages} className={secondaryButton}>Next</button>
        </div>
      </div>
      </>
      )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {currentView === 'home' ? (
        <div className="mx-auto max-w-5xl px-1 py-4 sm:py-6">
          <div className="mb-6 text-center">
            <h1 className="mb-1.5 text-[28px] font-bold tracking-tight text-fg md:text-[32px]">
              Pilih mata pelajaran
            </h1>
            <p className="text-[14px] text-fg-muted">
              Kelola soal berdasarkan mata pelajaran
            </p>
          </div>

          <div className="mx-auto mb-6 max-w-md">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  aria-label="Cari mata pelajaran"
                  placeholder="Cari mata pelajaran"
                  value={homeSearchQuery}
                  onChange={(e) => setHomeSearchQuery(e.target.value)}
                  className="glass-sheet h-12 w-full rounded-xl pl-11 pr-12 text-[14px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
                />
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                {homeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHomeSearchQuery('')}
                    aria-label="Clear search"
                    className="well-hover absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted transition-calm"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {canCreateQuestion && (
                <button
                  type="button"
                  onClick={() => setIsCreateMapelModalOpen(true)}
                  className="clay-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  title="Buat mapel baru"
                  aria-label="Buat mapel baru"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              className="glass-sheet flex items-center gap-4 rounded-3xl px-4 py-4 text-left transition-calm hover:border-line-strong sm:px-5"
              onClick={() => openMapel(null)}
            >
              <span className="clay flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-fg" aria-hidden="true">
                <Library size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold tracking-tight text-fg">Semua soal</span>
                <span className="mt-0.5 block text-[13px] tabular-nums text-fg-muted">{totalQuestionsAcrossMapels} soal</span>
              </span>
              <span className="text-[13px] font-semibold text-primary">Buka</span>
            </button>

            {visibleMapels.map((mapel) => {
              const mapelQuestionCount = mapelCounts.find(m => m.mapel === mapel.value)?.count || 0;

              return (
                <button
                  key={mapel.value}
                  type="button"
                  className="glass-sheet flex items-center gap-4 rounded-3xl px-4 py-4 text-left transition-calm hover:border-line-strong sm:px-5"
                  onClick={() => openMapel(mapel.value)}
                >
                  <span className="clay flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[18px] font-bold" aria-hidden="true">
                    {mapel.label.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold tracking-tight text-fg">{mapel.label}</span>
                    <span className="mt-0.5 block text-[13px] tabular-nums text-fg-muted">{mapelQuestionCount} soal</span>
                  </span>
                  <span className="text-[13px] font-semibold text-primary">Buka</span>
                </button>
              );
            })}
          </div>

          {homeSearchQuery && visibleMapels.length === 0 && (
            <p className="mt-6 text-center text-[14px] text-fg-muted">
              Tidak ada mapel yang cocok dengan &ldquo;{homeSearchQuery}&rdquo;.
            </p>
          )}
        </div>
      ) : (
      questionLoading ? (
        <div className="glass flex items-center justify-center gap-2 rounded-3xl px-4 py-12 text-[13px] font-medium text-fg-muted" role="status">
          <span className="spinner-calm h-4 w-4" aria-hidden="true" />
          Loading questions…
        </div>
      ) : (
        questionViewMode === 'card' ? (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {paginatedQuestions.length === 0 && (
              <div className="glass col-span-full rounded-3xl px-4 py-12 text-center">
                <p className="text-[15px] font-semibold text-fg">No questions found for the selected topics.</p>
                <p className="mt-1 text-[13px] text-fg-muted">Loosen the filters or add a question for this topic.</p>
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
                <div key={question.id ?? index} className="glass-sheet flex flex-col rounded-3xl px-4 py-4 sm:px-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-1">
                        <span className="clay inline-flex h-6 items-center rounded-md px-2 text-[12px] font-bold tabular-nums">#{question.id}</span>
                        <span className="well inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold text-fg-muted">{getQuestionTypeLabel(question)}</span>
                        <span className="well inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium text-fg-muted">{ownerLabel}</span>
                      </div>
                      <p className="text-[14px] leading-snug text-fg">
                        <span className="font-semibold text-fg-muted">Q{((safeQuestionPage - 1) * questionPageSize) + index + 1}.</span> {previewText.slice(0, 96)}{previewText.length > 96 ? '…' : ''}
                      </p>
                    </div>
                    {canEditQuestion && (
                      <label className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Select question ${question.id}`}
                          checked={selectedQuestionIds.includes(question.id)}
                          onChange={(e) => onToggleQuestionSelect(question.id, e.target.checked)}
                          className="h-5 w-5 cursor-pointer accent-[var(--primary)]"
                        />
                      </label>
                    )}
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {topicChips.length === 0 ? (
                      <span className="text-[12px] text-fg-muted">No topic</span>
                    ) : topicChips.map((chip) => (
                      <span key={chip.key} title={chip.title} className={topicChipClass}>
                        {chip.value}
                      </span>
                    ))}
                  </div>
                  {updatedAtLabel && <p className="mb-3 text-[12px] text-fg-muted">Updated: {updatedAtLabel}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => onViewQuestion(question)} className={`${rowAction} well well-hover text-fg`}>View</button>
                      {canEditQuestion && <button type="button" onClick={() => onEditQuestion(question)} className={`${rowAction} bg-primary/12 text-primary hover:bg-primary/18`}>Edit</button>}
                      {canDeleteQuestion && <button type="button" onClick={() => onDeleteQuestion(question)} className={`${rowAction} bg-danger/10 text-danger hover:bg-danger/15`}>Delete</button>}
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditQuestion && (
                        <VisibilitySwitch hidden={question.is_hidden} onToggle={() => onToggleQuestionVisibility(question)} />
                      )}
                      <VisibilityChip hidden={question.is_hidden} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-3xl">
            <div className="results-table-scroll-light overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left">
                <thead>
                  <tr>
                    <th className="w-14 border-b border-line px-3 py-3 text-[12px] font-semibold text-fg-muted"><span className="sr-only">Select</span></th>
                    <th className="w-16 border-b border-line px-4 py-3 text-[12px] font-semibold text-fg-muted">ID</th>
                    <th className="w-40 border-b border-line px-4 py-3 text-[12px] font-semibold text-fg-muted">Status</th>
                    <th className="w-20 border-b border-line px-4 py-3 text-[12px] font-semibold text-fg-muted">Type</th>
                    <th className="min-w-[260px] border-b border-line px-4 py-3 text-[12px] font-semibold text-fg-muted">Question</th>
                    <th className="min-w-[260px] border-b border-line px-4 py-3 text-[12px] font-semibold text-fg-muted">Topic</th>
                    <th className="w-32 border-b border-line px-4 py-3 text-[12px] font-semibold text-fg-muted">Owner</th>
                    <th className="w-52 border-b border-line px-4 py-3 text-[12px] font-semibold text-fg-muted"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedQuestions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <p className="text-[15px] font-semibold text-fg">No questions found for the selected topics.</p>
                        <p className="mt-1 text-[13px] text-fg-muted">Loosen the filters or add a question for this topic.</p>
                      </td>
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
                      <tr key={question.id} className="border-b border-line align-middle transition-calm last:border-b-0 hover:bg-[var(--well-bg)]">
                        <td className="px-2 py-1">
                          {canEditQuestion && (
                            <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                aria-label={`Select question ${question.id}`}
                                checked={selectedQuestionIds.includes(question.id)}
                                onChange={(e) => onToggleQuestionSelect(question.id, e.target.checked)}
                                className="h-[18px] w-[18px] cursor-pointer accent-[var(--primary)]"
                              />
                            </label>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-fg-muted">#{question.id}</td>
                        <td className="px-4 py-1">
                          <div className="flex items-center gap-2">
                            {canEditQuestion && (
                              <VisibilitySwitch hidden={question.is_hidden} onToggle={() => onToggleQuestionVisibility(question)} />
                            )}
                            <VisibilityChip hidden={question.is_hidden} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-fg-muted">{getQuestionTypeLabel(question)}</td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 text-[14px] text-fg">{previewText || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[320px] flex-wrap gap-1">
                            {topicChips.length === 0 ? (
                              <span className="text-[12px] text-fg-muted">-</span>
                            ) : topicChips.map((chip) => (
                              <span key={chip.key} title={chip.title} className={topicChipClass}>
                                {chip.value}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="well inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium text-fg-muted">{ownerLabel}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => onViewQuestion(question)} className={`${rowAction} well well-hover text-fg`}>View</button>
                            {canEditQuestion && <button type="button" onClick={() => onEditQuestion(question)} className={`${rowAction} bg-primary/12 text-primary hover:bg-primary/18`}>Edit</button>}
                            {canDeleteQuestion && <button type="button" onClick={() => onDeleteQuestion(question)} className={`${rowAction} bg-danger/10 text-danger hover:bg-danger/15`}>Delete</button>}
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
        <motion.div {...scrimMotion} key="create-mapel-overlay" className="glass-scrim fixed inset-0 z-[100000] flex items-center justify-center p-4" onClick={() => setIsCreateMapelModalOpen(false)}>
          <motion.div
            {...sheetMotion}
            key="create-mapel-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-mapel-title"
            className="glass-sheet w-full max-w-md overflow-hidden rounded-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
              <h3 id="create-mapel-title" className="text-[18px] font-bold tracking-tight text-fg">
                Buat mapel baru
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateMapelModalOpen(false)}
                aria-label="Close"
                className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
              >
                <X size={16} />
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
              <div className="space-y-4 p-5 sm:p-6">
                <div>
                  <label htmlFor="new-mapel-name" className="mb-2 block text-[13px] font-medium text-fg-muted">
                    Nama mapel
                  </label>
                  <input
                    id="new-mapel-name"
                    type="text"
                    value={newMapelName}
                    onChange={(e) => setNewMapelName(e.target.value)}
                    placeholder="Contoh: Matematika, Fisika, Biologi"
                    autoFocus
                    className="well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
                  />
                </div>

                <div className="rounded-2xl bg-primary/10 px-4 py-3">
                  <p className="text-[13px] text-fg">
                    Setelah membuat mapel baru, Anda harus membuat minimal 1 soal untuk mapel tersebut.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 border-t border-line px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={closeCreateMapelModal}
                  className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold"
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
        <div className="glass-scrim fixed inset-0 z-[100001] flex items-center justify-center p-4" onClick={() => setIsConfirmRedirectModalOpen(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="redirect-mapel-title"
            className="glass-sheet animate-in w-full max-w-md rounded-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 id="redirect-mapel-title" className="mb-2 text-[18px] font-bold tracking-tight text-fg">
                Mapel sudah ada
              </h3>
              <p className="mb-6 text-[14px] leading-relaxed text-fg-muted">
                Mapel &ldquo;{existingMapelInfo.label}&rdquo; sudah ada. Arahkan ke mapel tersebut?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmRedirectModalOpen(false);
                    setExistingMapelInfo(null);
                  }}
                  className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setIsConfirmRedirectModalOpen(false);
                    setIsCreateMapelModalOpen(false);
                    setNewMapelName('');
                    setExistingMapelInfo(null);
                    setSelectedMapelFromHome(existingMapelInfo.slug);
                    onMapelFilterChange([existingMapelInfo.slug]);
                    setCurrentView('filtered');
                  }}
                  className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold"
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
