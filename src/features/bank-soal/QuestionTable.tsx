'use client';

import React, { useState } from 'react';
import {
  Eye, EyeOff, Edit3, Trash2, AlertTriangle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import RichContent from '@/src/components/RichContent';
import {
  toggleQuestionAction,
  bulkToggleAction,
  deleteQuestionAction,
  checkQuizConflictAction,
} from './actions';
import type { QuestionWithTopics } from './types';
import type { Visibility } from '@/src/features/kategori/types';

type QuestionTableProps = {
  questions: QuestionWithTopics[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onEdit: (q: QuestionWithTopics) => void;
  onRefresh: () => void;
};

export default function QuestionTable({
  questions,
  total,
  page,
  limit,
  onPageChange,
  onEdit,
  onRefresh,
}: QuestionTableProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [warningModal, setWarningModal] = useState<{
    warnings: string[];
    onConfirm: () => void;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: number;
  } | null>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(questions.map((q) => q.id));
    else setSelectedIds([]);
  };

  const handleToggleOne = async (q: QuestionWithTopics) => {
    const nextVis: Visibility = q.visibility === 'shown' ? 'hidden' : 'shown';

    // HS-06 check if hiding
    if (nextVis === 'hidden') {
      const conflictRes = await checkQuizConflictAction([q.id]);
      if (conflictRes.success && conflictRes.warnings && conflictRes.warnings.length > 0) {
        setWarningModal({
          warnings: conflictRes.warnings,
          onConfirm: async () => {
            setWarningModal(null);
            setLoadingId(q.id);
            await toggleQuestionAction(q.id, nextVis);
            setLoadingId(null);
            onRefresh();
          },
        });
        return;
      }
    }

    setLoadingId(q.id);
    await toggleQuestionAction(q.id, nextVis);
    setLoadingId(null);
    onRefresh();
  };

  const handleBulkToggle = async (vis: Visibility) => {
    if (!selectedIds.length) return;

    if (vis === 'hidden') {
      const conflictRes = await checkQuizConflictAction(selectedIds);
      if (conflictRes.success && conflictRes.warnings && conflictRes.warnings.length > 0) {
        setWarningModal({
          warnings: conflictRes.warnings,
          onConfirm: async () => {
            setWarningModal(null);
            setBulkLoading(true);
            await bulkToggleAction(selectedIds, vis);
            setBulkLoading(false);
            setSelectedIds([]);
            onRefresh();
          },
        });
        return;
      }
    }

    setBulkLoading(true);
    await bulkToggleAction(selectedIds, vis);
    setBulkLoading(false);
    setSelectedIds([]);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    setLoadingId(id);
    setDeleteConfirm(null);
    const res = await deleteQuestionAction(id);
    setLoadingId(null);
    if (res.success && 'message' in res && res.message) {
      setInfoModal(res.message);
    }
    onRefresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk action toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-2.5 px-4 rounded-2xl glass-strong border border-line-strong flex items-center justify-between text-xs animate-in">
          <span className="font-semibold text-fg">
            {selectedIds.length} soal terpilih
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => handleBulkToggle('shown')}
              className="px-3 py-1.5 rounded-xl well hover:bg-well-hover text-primary font-medium border border-line"
            >
              Set Shown (Tampil)
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => handleBulkToggle('hidden')}
              className="px-3 py-1.5 rounded-xl well hover:bg-well-hover text-danger font-medium border border-line"
            >
              Set Hidden (Sembunyikan)
            </button>
          </div>
        </div>
      )}

      {/* Table Shell */}
      <div className="rounded-3xl glass border border-line overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-canvas/80 border-b border-line text-fg-muted font-semibold">
              <tr>
                <th className="p-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={questions.length > 0 && selectedIds.length === questions.length}
                    onChange={handleSelectAll}
                    className="accent-primary"
                  />
                </th>
                <th className="p-3 w-14">ID</th>
                <th className="p-3 min-w-[260px]">Teks Soal</th>
                <th className="p-3 w-28">Tipe</th>
                <th className="p-3 min-w-[180px]">Kategori</th>
                <th className="p-3 w-28 text-center">Status</th>
                <th className="p-3 w-24">Tanggal</th>
                <th className="p-3 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-fg-subtle">
                    Tidak ada soal yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                questions.map((q) => {
                  const isChecked = selectedIds.includes(q.id);
                  return (
                    <tr
                      key={q.id}
                      className={`hover:bg-well/40 transition-colors ${isChecked ? 'bg-primary/5' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, q.id]);
                            else setSelectedIds(selectedIds.filter((id) => id !== q.id));
                          }}
                          className="accent-primary"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-fg">#{q.id}</td>
                      <td className="p-3">
                        <div className="max-h-16 overflow-hidden line-clamp-2 text-fg">
                          <RichContent html={q.body_html} className="text-xs" />
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          q.type === 'multiple_choice'
                            ? 'bg-pine-100 text-pine-800 dark:bg-pine-900/40 dark:text-pine-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {q.type === 'multiple_choice' ? 'Pilihan Ganda' : 'Isian Singkat'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {q.topics.map((t) => (
                            <span
                              key={t.topic_id}
                              className="px-1.5 py-0.5 rounded-md well border border-line text-[10px] text-fg-muted"
                              title={`${t.subject_name} / ${t.chapter_name} / ${t.topic_name}`}
                            >
                              {t.chapter_name}: {t.topic_name}
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* HS-04 Toggle status */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          disabled={loadingId === q.id}
                          onClick={() => handleToggleOne(q)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-transform active:scale-95 ${
                            q.visibility === 'shown'
                              ? 'bg-pine-500/15 border-pine-500/30 text-pine-700 dark:text-pine-300 hover:bg-pine-500/25'
                              : 'bg-brick-500/15 border-brick-500/30 text-brick-700 dark:text-brick-300 hover:bg-brick-500/25'
                          }`}
                          title="Klik untuk toggle status Shown / Hidden"
                        >
                          {q.visibility === 'shown' ? <Eye size={12} /> : <EyeOff size={12} />}
                          {q.visibility === 'shown' ? 'Shown' : 'Hidden'}
                        </button>
                      </td>
                      <td className="p-3 text-fg-subtle text-[11px]">
                        {new Date(q.updated_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(q)}
                            className="p-1.5 rounded-lg well hover:bg-well-hover text-fg-muted hover:text-fg"
                            title="Edit Soal"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ id: q.id })}
                            className="p-1.5 rounded-lg well hover:bg-brick-50 text-fg-muted hover:text-danger"
                            title="Hapus Soal"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-3 px-4 border-t border-line bg-canvas/60 text-xs text-fg-muted">
          <span>
            Menampilkan {questions.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
            {Math.min(page * limit, total)} dari {total} soal
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded-lg well hover:bg-well-hover disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-mono font-medium text-fg">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded-lg well hover:bg-well-hover disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* HS-06 Warning modal */}
      {warningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-glass-scrim backdrop-blur-xs">
          <div className="w-full max-w-md p-5 rounded-3xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-3">
            <div className="flex items-center gap-2 text-danger font-bold">
              <AlertTriangle size={20} />
              <h3>Peringatan Kuis Aktif (HS-06)</h3>
            </div>
            <p className="text-xs text-fg-muted">
              Soal berikut saat ini sedang dipakai pada sesi kuis yang berstatus aktif/jeda. Soal yang disembunyikan akan tetap berjalan di kuis tersebut karena daftar soal sudah disnapshot saat kuis dibuat.
            </p>
            <ul className="max-h-32 overflow-y-auto p-2 rounded-xl well border border-line text-xs space-y-1 text-fg">
              {warningModal.warnings.map((w, idx) => (
                <li key={idx}>&bull; {w}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setWarningModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium hover:bg-well text-fg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={warningModal.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold clay-danger"
              >
                Tetap Sembunyikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BS-05 Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-glass-scrim backdrop-blur-xs">
          <div className="w-full max-w-sm p-5 rounded-3xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-3">
            <h3 className="font-bold text-fg">Konfirmasi Hapus Soal #{deleteConfirm.id}</h3>
            <p className="text-xs text-fg-muted">
              Jika soal pernah dipakai dalam kuis atau ujian sebelumnya, soal akan otomatis <strong>diarsipkan</strong> (tidak dihapus fisik) agar riwayat jawaban siswa tidak rusak.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium hover:bg-well text-fg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold clay-danger"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info modal */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-glass-scrim backdrop-blur-xs">
          <div className="w-full max-w-sm p-5 rounded-3xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-3">
            <h3 className="font-bold text-fg">Informasi</h3>
            <p className="text-xs text-fg-muted">{infoModal}</p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold clay-primary"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
