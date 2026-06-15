'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, XCircle, Users, CalendarClock, TrendingUp, Users2, ChevronDown, Info } from 'lucide-react';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';
import {
  listScheduledExamsAction,
  createScheduledExamAction,
  publishScheduledExamAction,
  closeScheduledExamAction,
  listScheduledExamAttemptsAction,
  getScheduledExamHistoryAction,
  type ScheduledExamRow,
  type ScheduledExamAttemptRow,
  type ScheduledExamHistoryRow,
} from '@/app/actions/admin/scheduled-exam';
import { fetchAllMapelsAdmin, fetchBabsAdmin, fetchSubBabsAdmin } from '@/lib/questions';
import type { BabInfo, SubBabInfo } from '@/lib/questions';
import type { VisibilitySettings } from '@/lib/questions';
import { normalizeCategorySlug } from '@/lib/categories';

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180];
const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

type Props = {
  theme: 'light' | 'dark';
  visibilitySettings: VisibilitySettings;
};

type ActiveView = 'create' | 'manage' | 'history';
type ViewState =
  | { kind: 'list' }
  | { kind: 'attempts'; examId: string; examTitle: string };

const cardCls = (t: 'light' | 'dark') =>
  t === 'dark'
    ? 'rounded-[20px] border border-dark-border-subtle bg-dark-800 p-5'
    : 'rounded-[20px] border border-nike-grey-200 bg-white p-5';

const inputCls = (t: 'light' | 'dark') =>
  `w-full h-10 rounded-xl px-3 text-[13px] font-medium outline-none transition-spring-fast ${
    t === 'dark'
      ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium focus:border-accent-blue placeholder:text-dark-text-muted'
      : 'bg-nike-grey-100 text-nike-black border border-nike-grey-200 focus:border-dark-800 placeholder:text-gray-400'
  }`;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    draft: { icon: <Clock size={12} />, cls: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
    published: { icon: <CheckCircle2 size={12} />, cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
    closed: { icon: <XCircle size={12} />, cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  };
  const entry = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.cls}`}>
      {entry.icon} {status}
    </span>
  );
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Makassar',
  });
}

export default function ScheduledExamTabPanel({ theme, visibilitySettings }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_scheduled_active_view');
      if (saved === 'create' || saved === 'manage' || saved === 'history') return saved;
    }
    return 'create';
  });

  useEffect(() => {
    localStorage.setItem('admin_scheduled_active_view', activeView);
  }, [activeView]);

  const [view, setView] = useState<ViewState>({ kind: 'list' });
  const [exams, setExams] = useState<ScheduledExamRow[]>([]);
  const [history, setHistory] = useState<ScheduledExamHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAdminAccessToken();
      const data = await listScheduledExamsAction(token);
      setExams(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAdminAccessToken();
      const data = await getScheduledExamHistoryAction(token);
      setHistory(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat riwayat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'history') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadHistory();
    } else {
      void loadExams();
    }
  }, [activeView, loadExams, loadHistory]);

  if (view.kind === 'attempts') {
    return (
      <AttemptsPanel
        theme={theme}
        examId={view.examId}
        examTitle={view.examTitle}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  const t = theme;

  return (
    <div className="space-y-5">
      {/* Header + sub-tabs */}
      <div className={`rounded-3xl px-5 py-4 ${t === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <h2 className={`text-[20px] font-semibold tracking-tight ${t === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
              Ujian terjadwal
            </h2>
            <p className={`mt-0.5 text-[12px] ${t === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
              {activeView === 'history'
                ? 'Review riwayat ujian yang sudah ditutup.'
                : activeView === 'manage'
                ? 'Kelola ujian terjadwal, publish, dan pantau peserta.'
                : 'Buat ujian dengan kode akses dan jendela waktu.'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className={`inline-flex h-9 rounded-full p-0.5 ${t === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
            <button
              type="button"
              onClick={() => { setActiveView('create'); setView({ kind: 'list' }); }}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${activeView === 'create' ? (t === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (t === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setActiveView('manage'); setView({ kind: 'list' }); }}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${activeView === 'manage' ? (t === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (t === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              Manage
            </button>
            <button
              type="button"
              onClick={() => setActiveView('history')}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${activeView === 'history' ? (t === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (t === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className={`rounded-2xl p-4 text-[13px] font-medium ${t === 'dark' ? 'bg-accent-red/10 text-accent-red' : 'bg-red-50 text-red-600'}`}>
          {error}
          <button type="button" onClick={() => void (activeView === 'history' ? loadHistory() : loadExams())} className="ml-2 underline">Coba lagi</button>
        </div>
      )}

      {loading ? (
        <div className={`text-center py-12 text-[13px] ${t === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
          Memuat...
        </div>
      ) : (
        <>
          {/* Create view */}
          {activeView === 'create' && (
            <div className="min-h-0 flex-1">
              <div className="mx-auto max-w-2xl">
                <div className={`mb-3 rounded-[20px] border p-4 shadow-ios-sm ${t === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${t === 'dark' ? 'bg-accent-blue/15' : 'bg-blue-50'}`}>
                      <CalendarClock size={16} className={t === 'dark' ? 'text-accent-blue' : 'text-blue-600'} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-semibold tracking-tight ${t === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                        Buat ujian terjadwal
                      </h3>
                      <p className={`text-[11px] font-medium ${t === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                        Ujian dengan kode akses dan jendela waktu.
                      </p>
                    </div>
                  </div>
                </div>

                <CreateFormCard
                  theme={theme}
                  visibilitySettings={visibilitySettings}
                  onCreated={() => void loadExams()}
                />
              </div>
            </div>
          )}

          {/* Manage view: table */}
          {activeView === 'manage' && (
            <ManageTable
              exams={exams}
              theme={theme}
              onRefresh={() => void loadExams()}
              onViewAttempts={(examId, examTitle) => setView({ kind: 'attempts', examId, examTitle })}
              onError={(msg) => setError(msg)}
            />
          )}

          {/* History view: table */}
          {activeView === 'history' && (
            <HistoryTable
              history={history}
              theme={theme}
              onViewAttempts={(examId, examTitle) => setView({ kind: 'attempts', examId, examTitle })}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Manage Table ---------- */

function ManageTable({ exams, theme, onRefresh, onViewAttempts, onError }: {
  exams: ScheduledExamRow[];
  theme: 'light' | 'dark';
  onRefresh: () => void;
  onViewAttempts: (examId: string, examTitle: string) => void;
  onError: (msg: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const totalPages = Math.max(1, Math.ceil(exams.length / perPage));
  const paginated = exams.slice((page - 1) * perPage, page * perPage);

  return (
    <div className={`rounded-[24px] border shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
      {exams.length > 0 && (
        <div className={`mx-3 mt-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 sm:mx-6 ${theme === 'dark' ? 'border-dark-border-subtle bg-white/[0.03]' : 'border-nike-grey-200 bg-black/[0.02]'}`}>
          <div className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
            {exams.length} ujian terjadwal
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className={`h-8 rounded-full border px-3 text-[11px] font-semibold focus:outline-none ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue' : 'border-nike-grey-300 bg-white text-nike-black focus:border-dark-800'}`}
            >
              {[5, 10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <div className={`flex h-8 overflow-hidden rounded-full border ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750' : 'border-nike-grey-300 bg-white'}`}>
              <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Prev</button>
              <span className={`flex items-center border-x px-3 text-[11px] font-semibold ${theme === 'dark' ? 'border-dark-border-medium text-dark-text-tertiary' : 'border-nike-grey-200 text-dark-text-muted'}`}>{page}/{totalPages}</span>
              <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Next</button>
            </div>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-dark-border-subtle' : 'divide-surface-grey-100'}`}>
          <thead className={theme === 'dark' ? 'bg-white/[0.02]' : 'bg-surface-grey-150'}>
            <tr>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Judul</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Status</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Peserta</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Soal</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Durasi</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Window</th>
              <th className={`px-4 py-3 text-right text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-dark-border-subtle bg-dark-800' : 'divide-surface-grey-100 bg-white'}`}>
            {exams.length === 0 ? (
              <tr>
                <td colSpan={7} className={`px-4 py-10 text-center text-sm font-medium sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                  <CalendarClock size={28} className="mx-auto mb-2 opacity-40" />
                  Belum ada ujian terjadwal.
                </td>
              </tr>
            ) : paginated.map(exam => (
              <tr key={exam.id} className={theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}>
                <td className={`whitespace-nowrap px-4 py-3 text-sm font-semibold sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                  <span className="block max-w-[200px] truncate" title={exam.title}>{exam.title}</span>
                  {exam.access_code && (
                    <span className={`mt-0.5 block text-[10px] font-mono ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
                      {exam.access_code}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                  <StatusBadge status={exam.status} />
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                  <span className="flex items-center gap-1">
                    <Users size={12} className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'} />
                    <span className="font-medium">-</span>
                  </span>
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{exam.question_count}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{exam.time_limit_minutes} min</td>
                <td className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
                  <span className="block max-w-[140px] truncate" title={`${formatDateTime(exam.window_start)} - ${formatDateTime(exam.window_end)}`}>
                    {formatDateTime(exam.window_start)} - {formatDateTime(exam.window_end)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium sm:px-6 sm:py-4">
                  <div className="flex items-center justify-end gap-2">
                    {exam.status === 'draft' && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const token = await getAdminAccessToken();
                            await publishScheduledExamAction(token, exam.id);
                            onRefresh();
                          } catch (e) {
                            onError(e instanceof Error ? e.message : 'Gagal publish');
                          }
                        }}
                        className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        Publish
                      </button>
                    )}
                    {exam.status === 'published' && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const token = await getAdminAccessToken();
                            await closeScheduledExamAction(token, exam.id);
                            onRefresh();
                          } catch (e) {
                            onError(e instanceof Error ? e.message : 'Gagal tutup');
                          }
                        }}
                        className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                      >
                        Tutup
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onViewAttempts(exam.id, exam.title)}
                      className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}
                    >
                      <Users size={12} className="inline mr-1" />
                      Peserta
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- History Table ---------- */

function HistoryTable({ history, theme, onViewAttempts }: {
  history: ScheduledExamHistoryRow[];
  theme: 'light' | 'dark';
  onViewAttempts: (examId: string, examTitle: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const totalPages = Math.max(1, Math.ceil(history.length / perPage));
  const paginated = history.slice((page - 1) * perPage, page * perPage);

  return (
    <div className={`rounded-[24px] border shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
      {history.length > 0 && (
        <div className={`mx-3 mt-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 sm:mx-6 ${theme === 'dark' ? 'border-dark-border-subtle bg-white/[0.03]' : 'border-nike-grey-200 bg-black/[0.02]'}`}>
          <div className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
            {history.length} riwayat ujian
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className={`h-8 rounded-full border px-3 text-[11px] font-semibold focus:outline-none ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue' : 'border-nike-grey-300 bg-white text-nike-black focus:border-dark-800'}`}
            >
              {[5, 10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <div className={`flex h-8 overflow-hidden rounded-full border ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750' : 'border-nike-grey-300 bg-white'}`}>
              <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Prev</button>
              <span className={`flex items-center border-x px-3 text-[11px] font-semibold ${theme === 'dark' ? 'border-dark-border-medium text-dark-text-tertiary' : 'border-nike-grey-200 text-dark-text-muted'}`}>{page}/{totalPages}</span>
              <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Next</button>
            </div>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-dark-border-subtle' : 'divide-surface-grey-100'}`}>
          <thead className={theme === 'dark' ? 'bg-white/[0.02]' : 'bg-surface-grey-150'}>
            <tr>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Judul</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Status</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Nilai Tertinggi</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Peserta</th>
              <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Tanggal</th>
              <th className={`px-4 py-3 text-right text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-dark-border-subtle bg-dark-800' : 'divide-surface-grey-100 bg-white'}`}>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className={`px-4 py-10 text-center text-sm font-medium sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                  <TrendingUp size={28} className="mx-auto mb-2 opacity-40" />
                  Belum ada ujian yang sudah ditutup.
                </td>
              </tr>
            ) : paginated.map(exam => (
              <tr key={exam.id} className={theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}>
                <td className={`whitespace-nowrap px-4 py-3 text-sm font-semibold sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                  <span className="block max-w-[200px] truncate" title={exam.title}>{exam.title}</span>
                  {exam.access_code && (
                    <span className={`mt-0.5 block text-[10px] font-mono ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
                      {exam.access_code}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                  <StatusBadge status={exam.status} />
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-sm font-semibold tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-accent-green' : 'text-green-600'}`}>
                  {exam.avg_score != null ? exam.avg_score : '-'}
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                  <span className="flex items-center gap-1">
                    <Users2 size={12} className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'} />
                    <span className="font-medium">{exam.participant_count ?? '-'}</span>
                  </span>
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
                  {formatDateTime(exam.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium sm:px-6 sm:py-4">
                  <button
                    type="button"
                    onClick={() => onViewAttempts(exam.id, exam.title)}
                    className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}
                  >
                    <Users size={12} className="inline mr-1" />
                    Peserta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- CreateFormCard ---------- */

function CreateFormCard({ theme, visibilitySettings, onCreated }: {
  theme: 'light' | 'dark';
  visibilitySettings: VisibilitySettings;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(60);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [attemptMode, setAttemptMode] = useState<'single' | 'retake'>('single');
  const [mapels, setMapels] = useState<string[]>([]);
  const [babs, setBabs] = useState<string[]>([]);
  const [subBabs, setSubBabs] = useState<string[]>([]);
  const [availMapels, setAvailMapels] = useState<BabInfo[]>([]);
  const [availBabs, setAvailBabs] = useState<BabInfo[]>([]);
  const [availSubBabs, setAvailSubBabs] = useState<SubBabInfo[]>([]);
  const [navMode, setNavMode] = useState<'strict' | 'standard'>('strict');
  const [percentagesEnabled, setPercentagesEnabled] = useState(false);
  const [subBabPercentages, setSubBabPercentages] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown open states
  const [mapelOpen, setMapelOpen] = useState(false);
  const [babOpen, setBabOpen] = useState(false);
  const [subBabOpen, setSubBabOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [durOpen, setDurOpen] = useState(false);

  useEffect(() => {
    void fetchAllMapelsAdmin().then(raw => {
      setAvailMapels(raw.filter(m =>
        !visibilitySettings.hidden_mapels.includes(normalizeCategorySlug(m.value)) &&
        !visibilitySettings.admin_only_mapels.includes(normalizeCategorySlug(m.value))
      ));
    });
  }, [visibilitySettings]);

  useEffect(() => {
    if (mapels.length > 0) {
      void fetchBabsAdmin(mapels).then(raw => {
        setAvailBabs(raw.filter(b =>
          !visibilitySettings.hidden_babs.includes(normalizeCategorySlug(b.value)) &&
          !visibilitySettings.admin_only_babs.includes(normalizeCategorySlug(b.value))
        ));
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
    } else { setAvailBabs([]); }
    setBabs([]); setSubBabs([]);
  }, [mapels, visibilitySettings]);

  useEffect(() => {
    if (babs.length > 0) {
      void fetchSubBabsAdmin(babs).then(raw => {
        setAvailSubBabs(raw.filter(s =>
          !visibilitySettings.hidden_sub_babs?.includes(normalizeCategorySlug(s.value)) &&
          !visibilitySettings.admin_only_sub_babs?.includes(normalizeCategorySlug(s.value))
        ));
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
    } else { setAvailSubBabs([]); }
    setSubBabs([]);
  }, [babs, visibilitySettings]);

  const effectiveSubBabs = subBabs.length > 0 ? subBabs : availSubBabs.map(s => s.value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const token = await getAdminAccessToken();
      // Combine date + time into ISO string
      const ws = windowStart ? new Date(windowStart).toISOString() : '';
      const we = windowEnd ? new Date(windowEnd).toISOString() : '';
      await createScheduledExamAction(token, {
        title, accessCode, mapels, babs, subBabs,
        mode: 'exam', questionCount, timeLimitMinutes: timeLimit,
        windowStart: ws, windowEnd: we,
        attemptMode,
        navMode,
        subBabPercentages: percentagesEnabled ? subBabPercentages : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat ujian');
    } finally { setSaving(false); }
  };

  const generateAccessCode = () => {
    const source = title.trim() || (mapels[0] ?? '') || 'EXAM';
    const slug = source
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8) || 'EXAM';
    const suffix = Math.floor(1000 + Math.random() * 9000);
    setAccessCode(`${slug}${suffix}`.slice(0, 20));
  };

  const handleToggleMapel = (val: string) => {
    setMapels(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };
  const handleToggleBab = (val: string) => {
    setBabs(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };
  const handleToggleSubBab = (val: string) => {
    setSubBabs(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const closeAll = () => { setMapelOpen(false); setBabOpen(false); setSubBabOpen(false); setQcOpen(false); setDurOpen(false); };

  return (
    <div className={`overflow-hidden rounded-[24px] border shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
      <div className="p-5">
        {error && (
          <div className={`mb-4 rounded-2xl p-3 text-[13px] font-medium ${theme === 'dark' ? 'bg-accent-red/10 text-accent-red' : 'bg-red-50 text-red-600'}`}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" onClick={closeAll}>
          {/* Title */}
          <div onClick={(e) => e.stopPropagation()}>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Judul ujian</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
              placeholder="Contoh: Ujian Akhir Semester Genap" className={inputCls(theme)} />
          </div>

          {/* Access Code */}
          <div onClick={(e) => e.stopPropagation()}>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Kode akses</label>
            <div className="flex gap-2">
              <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase().slice(0, 20))} required
                placeholder="Contoh: UAS2025EKO" className={inputCls(theme)} />
              <button
                type="button"
                onClick={generateAccessCode}
                title="Generate kode acak dari judul / mapel"
                className={`shrink-0 h-10 px-3 rounded-xl text-[12px] font-semibold transition-spring-fast active:scale-95 inline-flex items-center gap-1.5 ${
                  theme === 'dark'
                    ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium hover:border-accent-blue'
                    : 'bg-nike-grey-100 text-nike-black border border-nike-grey-200 hover:border-dark-800'
                }`}
              >
                🎲 Random
              </button>
            </div>
          </div>

          {/* Mapel - Bab - Subbab: horizontal row */}
          <div onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Mapel */}
              <div className="relative">
                <label className={`block text-[11px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mapel</label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMapelOpen(v => !v); setBabOpen(false); setSubBabOpen(false); setQcOpen(false); setDurOpen(false); }}
                  className={`w-full min-h-[36px] rounded-xl px-3 py-1.5 flex items-center justify-between cursor-pointer transition-spring-fast border ${
                    theme === 'dark'
                      ? 'bg-dark-750 border-dark-border hover:border-accent-blue/50 text-dark-text-primary'
                      : 'bg-gray-50 border-gray-200 hover:border-blue-400 text-gray-900'
                  }`}
                >
                  <span className={`text-[11px] font-medium truncate ${mapels.length === 0 ? (theme === 'dark' ? 'text-dark-text-muted' : 'text-gray-400') : ''}`}>
                    {mapels.length === 0 ? 'Pilih mapel' : mapels.length === 1 ? mapels[0] : `${mapels.length} mapel dipilih`}
                  </span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${mapelOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} />
                </button>
                {mapelOpen && (
                  <div className={`absolute z-20 w-full mt-1.5 border rounded-xl max-h-[280px] overflow-y-auto shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                    {availMapels.length === 0 ? (
                      <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No mapel found</div>
                    ) : availMapels.map(m => {
                      const isSelected = mapels.includes(m.value);
                      return (
                        <div key={m.value} onClick={() => handleToggleMapel(m.value)}
                          className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border hover:bg-dark-750' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? (theme === 'dark' ? 'bg-accent-blue border-accent-blue' : 'bg-blue-500 border-blue-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bab */}
              <div className="relative">
                <label className={`block text-[11px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Bab</label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (mapels.length === 0) return; setBabOpen(v => !v); setMapelOpen(false); setSubBabOpen(false); setQcOpen(false); setDurOpen(false); }}
                  disabled={mapels.length === 0}
                  className={`w-full min-h-[36px] rounded-xl px-3 py-1.5 flex items-center justify-between transition-spring-fast border ${
                    mapels.length === 0
                      ? `cursor-not-allowed opacity-60 ${theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-muted' : 'bg-gray-50 border-gray-200 text-gray-400'}`
                      : `${theme === 'dark' ? 'bg-dark-750 border-dark-border hover:border-accent-blue/50 text-dark-text-primary' : 'bg-gray-50 border-gray-200 hover:border-blue-400 text-gray-900'}`
                  }`}
                >
                  <span className={`text-[11px] font-medium truncate`}>
                    {babs.length === 0 ? 'Pilih bab' : babs.length === 1 ? babs[0] : `${babs.length} bab dipilih`}
                  </span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${babOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} />
                </button>
                {babOpen && (
                  <div className={`absolute z-20 w-full mt-1.5 border rounded-xl max-h-[280px] overflow-y-auto shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                    {availBabs.length === 0 ? (
                      <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No bab found</div>
                    ) : availBabs.map(b => {
                      const isSelected = babs.includes(b.value);
                      return (
                        <div key={b.value} onClick={() => handleToggleBab(b.value)}
                          className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border hover:bg-dark-750' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? (theme === 'dark' ? 'bg-accent-red border-accent-red' : 'bg-red-500 border-red-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{b.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-bab */}
              <div className="relative">
                <label className={`block text-[11px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Sub-bab</label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (babs.length === 0) return; setSubBabOpen(v => !v); setMapelOpen(false); setBabOpen(false); setQcOpen(false); setDurOpen(false); }}
                  disabled={babs.length === 0}
                  className={`w-full min-h-[36px] rounded-xl px-3 py-1.5 flex items-center justify-between transition-spring-fast border ${
                    babs.length === 0
                      ? `cursor-not-allowed opacity-60 ${theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-muted' : 'bg-gray-50 border-gray-200 text-gray-400'}`
                      : `${theme === 'dark' ? 'bg-dark-750 border-dark-border hover:border-accent-blue/50 text-dark-text-primary' : 'bg-gray-50 border-gray-200 hover:border-blue-400 text-gray-900'}`
                  }`}
                >
                  <span className={`text-[11px] font-medium truncate`}>
                    {subBabs.length === 0 ? 'Pilih sub-bab' : subBabs.length === 1 ? subBabs[0] : `${subBabs.length} sub-bab dipilih`}
                  </span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${subBabOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} />
                </button>
                {subBabOpen && (
                  <div className={`absolute z-20 w-full mt-1.5 border rounded-xl max-h-[280px] overflow-y-auto shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                    {availSubBabs.length === 0 ? (
                      <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No sub-bab found</div>
                    ) : availSubBabs.map(s => {
                      const isSelected = subBabs.includes(s.value);
                      return (
                        <div key={s.value} onClick={() => handleToggleSubBab(s.value)}
                          className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border-subtle hover:bg-dark-750' : 'border-gray-50 hover:bg-gray-50'}`}>
                          <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? (theme === 'dark' ? 'bg-accent-purple border-accent-purple' : 'bg-indigo-500 border-indigo-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Persentase soal — below the horizontal row */}
          {effectiveSubBabs.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-dark-750 border-dark-border' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${theme === 'dark' ? 'bg-accent-purple/20 border-accent-purple/30' : 'bg-pink-soft border-pink-edge'}`}>
                      <span className="text-sm">📊</span>
                    </div>
                    <label className={`text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Persentase soal</label>
                  </div>
                  <button
                    onClick={() => {
                      const newState = !percentagesEnabled;
                      setPercentagesEnabled(newState);
                      if (newState) {
                        const newPct: Record<string, number> = { ...subBabPercentages };
                        const total = effectiveSubBabs.length;
                        if (total > 0) {
                          const equal = Math.floor(100 / total);
                          let rem = 100 - (equal * total);
                          effectiveSubBabs.forEach(v => {
                            newPct[v] = equal + (rem > 0 ? 1 : 0);
                            rem--;
                          });
                        }
                        setSubBabPercentages(newPct);
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${percentagesEnabled ? (theme === 'dark' ? 'bg-accent-blue focus:ring-accent-blue' : 'bg-link-blue focus:ring-link-blue') : (theme === 'dark' ? 'bg-dark-700' : 'bg-gray-200')}`}
                    role="switch"
                    aria-checked={percentagesEnabled}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${percentagesEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
                {percentagesEnabled && (
                  <div className={`space-y-2.5 mt-3 p-3 rounded-xl border ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-100'}`}>
                    {effectiveSubBabs.map(sub => {
                      const label = availSubBabs.find(d => d.value === sub)?.label || sub;
                      return (
                        <div key={sub} className="flex items-center justify-between gap-3">
                          <span className={`flex-1 truncate text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{label}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={subBabPercentages[sub] || 0}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setSubBabPercentages(prev => ({ ...prev, [sub]: val }));
                              }}
                              className={`w-14 h-7 text-center text-[11px] font-bold border rounded focus:outline-none ${theme === 'dark' ? 'bg-dark-800 border-dark-border text-dark-text-primary focus:border-accent-blue' : 'bg-white border-gray-300 text-gray-700 focus:border-link-blue'}`}
                            />
                            <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>%</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className={`pt-1.5 mt-1.5 border-t flex justify-between items-center ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'}`}>
                      <button
                        onClick={() => {
                          const newPct: Record<string, number> = { ...subBabPercentages };
                          const total = effectiveSubBabs.length;
                          if (total > 0) {
                            const equal = Math.floor(100 / total);
                            let rem = 100 - (equal * total);
                            effectiveSubBabs.forEach(v => {
                              newPct[v] = equal + (rem > 0 ? 1 : 0);
                              rem--;
                            });
                          }
                          setSubBabPercentages(newPct);
                        }}
                        className={`flex items-center gap-1 text-[11px] font-semibold transition-spring-fast hover:scale-[1.02] ${theme === 'dark' ? 'text-accent-purple hover:text-accent-purple/80' : 'text-indigo-500 hover:text-indigo-700'}`}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reset
                      </button>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Total</span>
                        <span className={`text-[11px] font-semibold tabular-nums ${effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0) === 100 ? (theme === 'dark' ? 'text-accent-green' : 'text-green-500') : (theme === 'dark' ? 'text-accent-red' : 'text-red-500')
                          }`}>
                          {effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Question Count + Duration — nice dropdown selects */}
          <div onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              {/* Question Count */}
              <div className="relative">
                <label className={`block text-[11px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Jumlah soal</label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setQcOpen(v => !v); setMapelOpen(false); setBabOpen(false); setSubBabOpen(false); setDurOpen(false); }}
                  className={`w-full min-h-[36px] rounded-xl px-3 py-1.5 flex items-center justify-between cursor-pointer transition-spring-fast border ${theme === 'dark' ? 'bg-dark-750 border-dark-border hover:border-accent-blue/50 text-dark-text-primary' : 'bg-gray-50 border-gray-200 hover:border-blue-400 text-gray-900'}`}
                >
                  <span className="text-[11px] font-bold">{questionCount} soal</span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${qcOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} />
                </button>
                {qcOpen && (
                  <div className={`absolute z-20 w-full mt-1.5 border rounded-xl overflow-hidden shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                    {QUESTION_COUNT_OPTIONS.map(n => (
                      <div key={n} onClick={() => { setQuestionCount(n); setQcOpen(false); }}
                        className={`px-3 py-2 cursor-pointer text-[11px] font-bold flex items-center justify-between ${n === questionCount ? (theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-600') : (theme === 'dark' ? 'text-dark-text-primary hover:bg-dark-750' : 'text-gray-900 hover:bg-gray-50')} ${theme === 'dark' ? 'border-dark-border' : 'border-gray-100'}`}>
                        {n} soal
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div className="relative">
                <label className={`block text-[11px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Batas waktu</label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDurOpen(v => !v); setMapelOpen(false); setBabOpen(false); setSubBabOpen(false); setQcOpen(false); }}
                  className={`w-full min-h-[36px] rounded-xl px-3 py-1.5 flex items-center justify-between cursor-pointer transition-spring-fast border ${theme === 'dark' ? 'bg-dark-750 border-dark-border hover:border-accent-green/50 text-dark-text-primary' : 'bg-gray-50 border-gray-200 hover:border-green-400 text-gray-900'}`}
                >
                  <span className="text-[11px] font-bold">{timeLimit} menit</span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${durOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} />
                </button>
                {durOpen && (
                  <div className={`absolute z-20 w-full mt-1.5 border rounded-xl overflow-hidden shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                    {DURATION_OPTIONS.map(m => (
                      <div key={m} onClick={() => { setTimeLimit(m); setDurOpen(false); }}
                        className={`px-3 py-2 cursor-pointer text-[11px] font-bold flex items-center justify-between ${m === timeLimit ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-600') : (theme === 'dark' ? 'text-dark-text-primary hover:bg-dark-750' : 'text-gray-900 hover:bg-gray-50')} ${theme === 'dark' ? 'border-dark-border' : 'border-gray-100'}`}>
                        {m} menit
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Attempt Mode toggle with tooltip */}
          <div onClick={(e) => e.stopPropagation()}>
            <label className={`block text-[11px] font-semibold mb-2 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mode percobaan</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAttemptMode('single')}
                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[11px] font-bold transition-spring-fast border ${
                  attemptMode === 'single'
                    ? (theme === 'dark' ? 'bg-dark-text-primary border-transparent text-dark-900' : 'bg-gray-900 border-transparent text-white')
                    : (theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-secondary hover:border-dark-text-primary' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400')
                }`}
              >
                Sekali
              </button>
              <button
                type="button"
                onClick={() => setAttemptMode('retake')}
                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[11px] font-bold transition-spring-fast border ${
                  attemptMode === 'retake'
                    ? (theme === 'dark' ? 'bg-accent-blue border-transparent text-white' : 'bg-blue-600 border-transparent text-white')
                    : (theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-secondary hover:border-accent-blue' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-400')
                }`}
              >
                Retake
              </button>
              <div className="relative group">
                <Info size={14} className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'} />
                <div className={`absolute bottom-full left-0 mb-2 hidden group-hover:block z-30 w-56 rounded-xl border p-3 text-[11px] font-medium shadow-xl ${theme === 'dark' ? 'bg-dark-800 border-dark-border text-dark-text-secondary' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {attemptMode === 'single' ? (
                    <>
                      <span className="font-bold text-accent-blue block mb-1">Sekali</span>
                      Peserta hanya bisa mengerjakan 1x. Nilai final langsung disimpan.
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-accent-blue block mb-1">Retake</span>
                      Peserta bisa mengerjakan berulang kali. Yang dihitung adalah nilai tertinggi.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Nav Mode */}
          <div onClick={(e) => e.stopPropagation()}>
            <label className={`block text-[11px] font-semibold mb-2 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mode navigasi</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNavMode('strict')}
                className={`h-[34px] rounded-xl text-[11px] font-bold transition-spring-fast border flex items-center justify-center gap-1.5 ${navMode === 'strict'
                  ? (theme === 'dark' ? 'bg-dark-text-primary border-transparent text-dark-900' : 'bg-gray-900 border-transparent text-white')
                  : (theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-secondary hover:border-dark-text-primary' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400')
                  }`}
              >
                🔒 STRICT
              </button>
              <button
                type="button"
                onClick={() => setNavMode('standard')}
                className={`h-[34px] rounded-xl text-[11px] font-bold transition-spring-fast border flex items-center justify-center gap-1.5 ${navMode === 'standard'
                  ? (theme === 'dark' ? 'bg-accent-blue border-transparent text-white' : 'bg-blue-600 border-transparent text-white')
                  : (theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-secondary hover:border-accent-blue' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-400')
                  }`}
              >
                📋 STANDARD
              </button>
            </div>
            <p className={`text-[9px] font-medium mt-1.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
              {navMode === 'strict' ? 'Soal harus dikerjakan berurutan, tidak bisa kembali.' : 'Peserta bisa bolak-balik soal dan menandai ragu-ragu.'}
            </p>
          </div>

          {/* Window Start / End — mobile-safe date + time inputs, at bottom */}
          <div onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Waktu Mulai</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={windowStart ? windowStart.split('T')[0] : ''}
                    onChange={(e) => setWindowStart(prev => {
                      const t = prev ? prev.split('T')[1]?.slice(0, 5) : '00:00';
                      return `${e.target.value}T${t}`;
                    })}
                    required
                    className={`flex-1 h-10 rounded-xl px-2 text-[11px] font-medium outline-none transition-spring-fast ${theme === 'dark' ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium focus:border-accent-blue' : 'bg-nike-grey-100 text-nike-black border border-nike-grey-200 focus:border-dark-800'}`}
                  />
                  <input
                    type="time"
                    value={windowStart ? windowStart.split('T')[1]?.slice(0, 5) : '00:00'}
                    onChange={(e) => setWindowStart(prev => {
                      const d = prev ? prev.split('T')[0] : new Date().toISOString().split('T')[0];
                      return `${d}T${e.target.value}`;
                    })}
                    required
                    className={`w-24 h-10 rounded-xl px-2 text-[11px] font-medium outline-none transition-spring-fast ${theme === 'dark' ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium focus:border-accent-blue' : 'bg-nike-grey-100 text-nike-black border border-nike-grey-200 focus:border-dark-800'}`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Waktu Selesai</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={windowEnd ? windowEnd.split('T')[0] : ''}
                    onChange={(e) => setWindowEnd(prev => {
                      const t = prev ? prev.split('T')[1]?.slice(0, 5) : '23:59';
                      return `${e.target.value}T${t}`;
                    })}
                    required
                    className={`flex-1 h-10 rounded-xl px-2 text-[11px] font-medium outline-none transition-spring-fast ${theme === 'dark' ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium focus:border-accent-blue' : 'bg-nike-grey-100 text-nike-black border border-nike-grey-200 focus:border-dark-800'}`}
                  />
                  <input
                    type="time"
                    value={windowEnd ? windowEnd.split('T')[1]?.slice(0, 5) : '23:59'}
                    onChange={(e) => setWindowEnd(prev => {
                      const d = prev ? prev.split('T')[0] : new Date().toISOString().split('T')[0];
                      return `${d}T${e.target.value}`;
                    })}
                    required
                    className={`w-24 h-10 rounded-xl px-2 text-[11px] font-medium outline-none transition-spring-fast ${theme === 'dark' ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium focus:border-accent-blue' : 'bg-nike-grey-100 text-nike-black border border-nike-grey-200 focus:border-dark-800'}`}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`w-full h-11 rounded-2xl text-[14px] font-semibold transition-spring-fast active:scale-95 disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-accent-blue text-white hover:bg-accent-blue/80'
                : 'bg-dark-800 text-white hover:bg-nike-black-hover'
            }`}
          >
            {saving ? 'Menyimpan...' : 'Buat ujian'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- AttemptsPanel ---------- */

function AttemptsPanel({ theme, examId, examTitle, onBack }: {
  theme: 'light' | 'dark'; examId: string; examTitle: string; onBack: () => void;
}) {
  const [attempts, setAttempts] = useState<ScheduledExamAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getAdminAccessToken()
      .then((t) => listScheduledExamAttemptsAction(t, examId))
      .then((data) => { setAttempts(data); setLoading(false); });
  }, [examId]);

  return (
    <div>
      <button type="button" onClick={onBack} className={`mb-4 text-[13px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary hover:text-dark-text-primary' : 'text-gray-500 hover:text-gray-900'}`}>
        &larr; Kembali
      </button>
      <h2 className={`text-lg font-bold tracking-tight mb-1 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
        Peserta: {examTitle}
      </h2>
      <p className={`text-[12px] mb-4 ${theme === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
        {attempts.length} peserta
      </p>

      {loading ? (
        <p className={`text-[13px] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>Memuat...</p>
      ) : attempts.length === 0 ? (
        <p className={`text-[13px] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>Belum ada peserta.</p>
      ) : (
        <div className={cardCls(theme)}>
          <div className="space-y-3">
            {attempts.map((a) => (
              <div key={a.id} className={`flex items-center justify-between py-2 border-b last:border-b-0 ${theme === 'dark' ? 'border-dark-border-subtle' : 'border-surface-grey-100'}`}>
                <div>
                  <p className={`text-[13px] font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
                    {a.student_name}
                  </p>
                  <p className={`text-[11px] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
                    {formatDateTime(a.started_at)}
                    {a.auto_submitted && <span className="ml-2 text-orange-500">(auto-submit)</span>}
                  </p>
                </div>
                <div className="text-right">
                  {a.submitted_at ? (
                    <span className={`text-[14px] font-bold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
                      {a.score ?? '-'}
                    </span>
                  ) : (
                    <span className={`text-[12px] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
                      Sedang mengerjakan
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
