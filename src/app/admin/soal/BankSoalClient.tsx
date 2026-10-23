'use client';

import React, { useState, useTransition, useCallback } from 'react';
import { Plus, Upload, BookOpen } from 'lucide-react';
import QuestionFilters from '@/src/features/bank-soal/QuestionFilters';
import QuestionTable from '@/src/features/bank-soal/QuestionTable';
import QuestionFormModal from '@/src/features/bank-soal/QuestionFormModal';
import ImportModal from '@/src/features/bank-soal/ImportModal';
import { listQuestionsAction } from '@/src/features/bank-soal/actions';
import type { QuestionFilter, QuestionWithTopics } from '@/src/features/bank-soal/types';
import type { SubjectNode } from '@/src/features/kategori/types';

type BankSoalClientProps = {
  initialQuestions: QuestionWithTopics[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  categories: SubjectNode[];
};

export default function BankSoalClient({
  initialQuestions,
  initialTotal,
  initialPage,
  initialLimit,
  categories,
}: BankSoalClientProps) {
  const [questions, setQuestions] = useState<QuestionWithTopics[]>(initialQuestions);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState<number>(initialPage);
  const [filters, setFilters] = useState<QuestionFilter>({ page: 1, limit: initialLimit });

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithTopics | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const fetchQuestions = useCallback((nextFilters: QuestionFilter) => {
    startTransition(async () => {
      try {
        const res = await listQuestionsAction(nextFilters);
        if ('rows' in res && res.rows) {
          setQuestions(res.rows);
          setTotal(res.total);
          setPage(res.page);
        }
      } catch (err) {
        console.error('Failed to load questions:', err);
      }
    });
  }, []);

  const handleFilterChange = (next: QuestionFilter) => {
    setFilters(next);
    fetchQuestions(next);
  };

  const handleResetFilters = () => {
    const empty: QuestionFilter = { page: 1, limit: initialLimit };
    setFilters(empty);
    fetchQuestions(empty);
  };

  const handlePageChange = (newPage: number) => {
    const next = { ...filters, page: newPage };
    setFilters(next);
    fetchQuestions(next);
  };

  const handleCreate = () => {
    setEditingQuestion(null);
    setFormModalOpen(true);
  };

  const handleEdit = (q: QuestionWithTopics) => {
    setEditingQuestion(q);
    setFormModalOpen(true);
  };

  const handleRefresh = () => {
    fetchQuestions(filters);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen size={24} className="text-primary" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-fg">Bank Soal (BS-01 &ndash; BS-09)</h1>
            <p className="text-xs text-fg-muted">
              Total {total} soal tersedia &bull; Pagination 25 per halaman &bull; Word-style Editor TipTap
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl well hover:bg-well-hover text-xs font-semibold text-fg flex items-center gap-1.5 border border-line"
          >
            <Upload size={15} /> Impor CSV / XLSX
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="px-4 py-2 rounded-2xl text-xs font-bold clay-primary flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={16} /> Tambah Soal
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <QuestionFilters
        filters={filters}
        categories={categories}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Loading state indicator */}
      {isPending && (
        <div className="text-xs text-center text-primary font-medium animate-pulse py-1">
          Memuat data bank soal...
        </div>
      )}

      {/* Table */}
      <QuestionTable
        questions={questions}
        total={total}
        page={page}
        limit={initialLimit}
        onPageChange={handlePageChange}
        onEdit={handleEdit}
        onRefresh={handleRefresh}
      />

      {/* Form Modal */}
      <QuestionFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        question={editingQuestion}
        categories={categories}
        onSuccess={handleRefresh}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
