'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, Clock, RotateCcw, Shuffle, TrendingUp, Users, Users2, XCircle } from 'lucide-react';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';
import {
  listScheduledExamsAction,
  createScheduledExamAction,
  listScheduledExamAttemptsAction,
  getScheduledExamHistoryAction,
  selectRandomQuestionsAction,
  fetchScheduledExamQuestionPoolAction,
  type ScheduledExamRow,
  type ScheduledExamAttemptRow,
  type ScheduledExamHistoryRow,
} from '@/app/actions/admin/scheduled-exam';
import ScheduledExamDetailsModal from './ScheduledExamDetailsModal';
import AdminTutorialModal from './AdminTutorialModal';
import { PageBar } from './ResultsTabPanel';
import { tableHeadCell, tableRow } from './ResultsHistoryTable';
import { fetchAllMapelsAdmin, fetchBabsAdmin, fetchSubBabsAdmin } from '@/lib/questions';
import type { BabInfo, SubBabInfo, RawQuestion } from '@/lib/questions';
import type { VisibilitySettings } from '@/lib/questions';
import { getCorrectOptionText } from '@/app/hooks/adminOptionText';
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
  | { kind: 'attempts'; examId: string; examTitle: string }
  | { kind: 'newly-created'; examId: string };

// Shared recipes for this tab (DESIGN.md: glass surfaces, well controls, clay for the one primary action).
const ui = {
  label: 'mb-1.5 block text-[13px] font-semibold text-fg',
  hint: 'mt-1.5 text-[12px] text-fg-muted',
  input: 'well h-11 w-full min-w-0 rounded-xl px-3 text-[14px] font-medium text-fg placeholder:text-fg-subtle transition-calm',
  trigger: (disabled: boolean) => `well flex h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left transition-calm ${disabled ? 'cursor-not-allowed opacity-60' : 'well-hover cursor-pointer'}`,
  panel: 'glass-strong animate-in absolute z-20 mt-1.5 max-h-[280px] w-full overflow-y-auto rounded-2xl p-1.5',
  option: 'well-hover flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left transition-calm',
  check: (checked: boolean) => `flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md ${checked ? 'bg-primary text-on-primary' : 'border border-line-strong'}`,
  segment: (active: boolean) => `h-11 md:h-10 flex-1 rounded-lg px-3 text-[13px] font-semibold transition-calm ${active ? 'clay' : 'text-fg-muted hover:text-fg'}`,
  secondary: 'well well-hover flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm disabled:cursor-not-allowed disabled:opacity-50',
  rowAction: 'h-11 md:h-10 rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18',
  cell: 'whitespace-nowrap px-3 py-3 text-[14px] sm:px-5',
};

function CheckMark() {
  return (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
    </svg>
  );
}

const STATUS_STYLE: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  active: { icon: <CheckCircle2 size={13} />, className: 'bg-primary/12 text-primary', label: 'Aktif' },
  scheduled: { icon: <Clock size={13} />, className: 'well text-fg-muted', label: 'Terjadwal' },
  expired: { icon: <XCircle size={13} />, className: 'well text-fg-subtle', label: 'Berakhir' },
};

function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_STYLE[status] || { ...STATUS_STYLE.scheduled, label: status };
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold ${entry.className}`}>
      <span aria-hidden="true">{entry.icon}</span>
      {entry.label}
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

function formatCategorySelectionLabel(value?: string | null): string {
  if (!value) return '-';
  return value
    .split(',')[0]
    .trim()
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function ScheduledExamTabPanel({ theme, visibilitySettings }: Props) {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_scheduled_active_view');
      if (saved === 'create' || saved === 'manage' || saved === 'history') return saved as ActiveView;
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
      <div data-theme={theme}>
        <AttemptsPanel
          examId={view.examId}
          examTitle={view.examTitle}
          onBack={() => setView({ kind: 'list' })}
        />
      </div>
    );
  }

  const views: { id: ActiveView; label: string }[] = [
    { id: 'create', label: 'Create' },
    { id: 'manage', label: 'Manage' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div data-theme={theme} className="space-y-3">
      {/* Header + sub-tabs */}
      <div className="glass rounded-3xl px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[200px] flex-1">
            <h2 className="text-[22px] font-bold tracking-tight text-fg">
              Ujian terjadwal
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              {activeView === 'history'
                ? 'Review riwayat ujian yang sudah ditutup.'
                : activeView === 'manage'
                ? 'Kelola ujian terjadwal, publish, dan pantau peserta.'
                : 'Buat ujian dengan kode akses dan jendela waktu.'}
            </p>
          </div>
          <button type="button" onClick={() => setIsTutorialOpen(true)} className={ui.secondary}>
            Tutorial
          </button>
        </div>
        <div className="well mt-4 inline-flex gap-1 rounded-xl p-1" role="group" aria-label="Tampilan">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={activeView === item.id}
              onClick={() => { setActiveView(item.id); if (item.id !== 'history') setView({ kind: 'list' }); }}
              className={`${ui.segment(activeView === item.id)} px-4`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger" role="alert">
          {error}
          <button type="button" onClick={() => void (activeView === 'history' ? loadHistory() : loadExams())} className="h-11 rounded-xl px-3 underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass flex items-center justify-center gap-2 rounded-3xl py-12 text-[13px] font-medium text-fg-muted" role="status">
          <span className="spinner-calm h-4 w-4" aria-hidden="true" />
          Memuat...
        </div>
      ) : (
        <>
          {/* Create view */}
          {activeView === 'create' && (
            <div className="mx-auto max-w-2xl">
              <div className="glass mb-3 flex items-center gap-3 rounded-3xl px-4 py-4">
                <div className="clay flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" aria-hidden="true">
                  <CalendarClock size={18} className="text-fg-muted" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold tracking-tight text-fg">
                    Buat ujian terjadwal
                  </h3>
                  <p className="text-[13px] text-fg-muted">
                    Ujian dengan kode akses dan jendela waktu.
                  </p>
                </div>
              </div>

              <CreateFormCard
                visibilitySettings={visibilitySettings}
                onCreated={(examId: string) => {
                  setActiveView('manage');
                  setView({ kind: 'newly-created', examId });
                  void loadExams();
                }}
              />
            </div>
          )}

          {/* Manage view: table */}
          {activeView === 'manage' && (
            <ManageTable
              exams={exams}
              theme={theme}
              formatCategorySelectionLabel={formatCategorySelectionLabel}
              newlyCreatedExamId={view.kind === 'newly-created' ? view.examId : null}
            />
          )}

          {/* History view: table */}
          {activeView === 'history' && (
            <HistoryTable
              history={history}
              onViewAttempts={(examId, examTitle) => setView({ kind: 'attempts', examId, examTitle })}
            />
          )}
        </>
      )}
      <AdminTutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} type="scheduled" />
    </div>
  );
}

/* ---------- Fetch helper: question pool for a scheduled exam ---------- */
async function fetchExamPoolQuestions(exam: ScheduledExamRow, accessToken: string) {
  const ids = exam.question_ids ?? [];
  if (ids.length === 0) return [];
  return fetchScheduledExamQuestionPoolAction(accessToken, ids);
}

/* ---------- Manage Table ---------- */

function ManageTable({ exams, theme, formatCategorySelectionLabel, newlyCreatedExamId }: {
  exams: ScheduledExamRow[];
  theme: 'light' | 'dark';
  formatCategorySelectionLabel: (value?: string | null) => string;
  newlyCreatedExamId: string | null;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [viewingExam, setViewingExam] = useState<ScheduledExamRow | null>(null);
  const [attempts, setAttempts] = useState<ScheduledExamAttemptRow[]>([]);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [detailQuestions, setDetailQuestions] = useState<RawQuestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleViewExam = async (exam: ScheduledExamRow) => {
    setViewingExam(exam);
    setAttemptLoading(true);
    setDetailLoading(true);
    setAttempts([]);
    setDetailQuestions([]);
    try {
      const token = await getAdminAccessToken();
      const [attemptsData, questionsData] = await Promise.all([
        listScheduledExamAttemptsAction(token, exam.id),
        fetchExamPoolQuestions(exam, token),
      ]);
      setAttempts(attemptsData);
      setDetailQuestions(questionsData);
    } catch (e) {
      console.error(e);
    } finally {
      setAttemptLoading(false);
      setDetailLoading(false);
    }
  };

  // Auto-open modal for newly created exam once exams list is loaded
  useEffect(() => {
    if (newlyCreatedExamId && exams.length > 0) {
      const exam = exams.find(e => e.id === newlyCreatedExamId);
      if (exam) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void handleViewExam(exam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyCreatedExamId, exams.length]);

  const totalPages = Math.max(1, Math.ceil(exams.length / perPage));
  const paginated = exams.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      {exams.length > 0 && (
        <PageBar
          page={page}
          perPage={perPage}
          total={exams.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPerPageChange={(size) => { setPerPage(size); setPage(1); }}
        />
      )}
      <div className="glass overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className={tableHeadCell}>Judul</th>
                <th className={tableHeadCell}>Kode</th>
                <th className={tableHeadCell}>Status</th>
                <th className={tableHeadCell}>Peserta</th>
                <th className={tableHeadCell}>Soal</th>
                <th className={tableHeadCell}>Durasi</th>
                <th className={tableHeadCell}>Waktu dibuat</th>
                <th className={`${tableHeadCell} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <CalendarClock size={26} className="mx-auto mb-2 text-fg-subtle" aria-hidden="true" />
                    <p className="text-[14px] font-semibold text-fg">Belum ada ujian terjadwal.</p>
                    <p className="mt-1 text-[13px] text-fg-muted">Buat ujian dari tab Create.</p>
                  </td>
                </tr>
              ) : paginated.map(exam => (
                <tr key={exam.id} className={tableRow}>
                  <td className={`${ui.cell} font-semibold text-fg`}>
                    <span className="block max-w-[220px] truncate" title={exam.title}>{exam.title}</span>
                  </td>
                  <td className={ui.cell}>
                    {exam.access_code && (
                      <span className="well rounded-lg px-2.5 py-1 font-mono text-[12px] font-semibold tracking-wide text-fg">
                        {exam.access_code}
                      </span>
                    )}
                  </td>
                  <td className={ui.cell}>
                    <StatusBadge status={exam.status} />
                  </td>
                  <td className={`${ui.cell} text-fg-muted`}>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} className="text-fg-subtle" aria-hidden="true" />
                      <span className="font-medium tabular-nums">{exam.participant_count ?? '-'}</span>
                    </span>
                  </td>
                  <td className={`${ui.cell} tabular-nums text-fg-muted`}>{exam.question_count}</td>
                  <td className={`${ui.cell} tabular-nums text-fg-muted`}>{exam.time_limit_minutes} min</td>
                  <td className={`${ui.cell} tabular-nums text-fg-muted`}>
                    {formatDateTime(exam.created_at)}
                  </td>
                  <td className={`${ui.cell} text-right`}>
                    <button type="button" onClick={() => handleViewExam(exam)} className={ui.rowAction}>
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ScheduledExamDetailsModal
        exam={viewingExam}
        attempts={attempts}
        attemptLoading={attemptLoading}
        detailQuestions={detailQuestions}
        detailLoading={detailLoading}
        formatCategorySelectionLabel={formatCategorySelectionLabel}
        getCorrectOptionText={getCorrectOptionText}
        onClose={() => setViewingExam(null)}
        theme={theme}
      />
    </>
  );
}

/* ---------- History Table ---------- */

function HistoryTable({ history, onViewAttempts }: {
  history: ScheduledExamHistoryRow[];
  onViewAttempts: (examId: string, examTitle: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const totalPages = Math.max(1, Math.ceil(history.length / perPage));
  const paginated = history.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      {history.length > 0 && (
        <PageBar
          page={page}
          perPage={perPage}
          total={history.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPerPageChange={(size) => { setPerPage(size); setPage(1); }}
        />
      )}
      <div className="glass overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className={tableHeadCell}>Judul</th>
                <th className={tableHeadCell}>Status</th>
                <th className={tableHeadCell}>Rata-rata nilai</th>
                <th className={tableHeadCell}>Peserta</th>
                <th className={tableHeadCell}>Tanggal</th>
                <th className={`${tableHeadCell} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <TrendingUp size={26} className="mx-auto mb-2 text-fg-subtle" aria-hidden="true" />
                    <p className="text-[14px] font-semibold text-fg">Belum ada ujian yang sudah ditutup.</p>
                    <p className="mt-1 text-[13px] text-fg-muted">Ujian muncul di sini setelah jendela waktunya berakhir.</p>
                  </td>
                </tr>
              ) : paginated.map(exam => (
                <tr key={exam.id} className={tableRow}>
                  <td className={`${ui.cell} font-semibold text-fg`}>
                    <span className="block max-w-[220px] truncate" title={exam.title}>{exam.title}</span>
                    {exam.access_code && (
                      <span className="mt-0.5 block font-mono text-[12px] font-medium text-fg-muted">
                        {exam.access_code}
                      </span>
                    )}
                  </td>
                  <td className={ui.cell}>
                    <StatusBadge status={exam.status} />
                  </td>
                  <td className={`${ui.cell} font-semibold tabular-nums text-fg`}>
                    {exam.avg_score != null ? exam.avg_score : '-'}
                  </td>
                  <td className={`${ui.cell} text-fg-muted`}>
                    <span className="flex items-center gap-1.5">
                      <Users2 size={14} className="text-fg-subtle" aria-hidden="true" />
                      <span className="font-medium tabular-nums">{exam.participant_count ?? '-'}</span>
                    </span>
                  </td>
                  <td className={`${ui.cell} tabular-nums text-fg-muted`}>
                    {formatDateTime(exam.created_at)}
                  </td>
                  <td className={`${ui.cell} text-right`}>
                    <button
                      type="button"
                      onClick={() => onViewAttempts(exam.id, exam.title)}
                      className={`${ui.secondary} ml-auto h-11 md:h-10`}
                    >
                      <Users size={14} className="text-fg-subtle" aria-hidden="true" />
                      Peserta
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- CreateFormCard ---------- */

function CreateFormCard({ visibilitySettings, onCreated }: {
  visibilitySettings: VisibilitySettings;
  onCreated: (examId: string) => void;
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
      // ─── Step 1: Select N random questions from the pool ───────────────────
      // All students will get these exact IDs (same pool, same order).
      // Only option order is shuffled per-student (client-side shuffleOptions).
      const selectedMapels = mapels.length > 0 ? mapels : availMapels.map(m => m.value);
      const selectedBabs = babs.length > 0 ? babs : availBabs.map(b => b.value);
      const selectedSubBabs = subBabs.length > 0 ? subBabs : availSubBabs.map(s => s.value);

      const questionIds = await selectRandomQuestionsAction(token, {
        mapels: selectedMapels,
        babs: selectedBabs,
        subBabs: selectedSubBabs,
        count: questionCount,
      });

      // ─── Step 2: Create the exam with the pre-selected question pool ───────
      if (!windowStart || !windowEnd) throw new Error("Waktu mulai dan berakhir harus diisi");
      const ws = new Date(windowStart).toISOString();
      const we = new Date(windowEnd).toISOString();
      const newExamId = await createScheduledExamAction(token, {
        title, accessCode, mapels, babs, subBabs,
        mode: 'exam', questionCount, timeLimitMinutes: timeLimit,
        windowStart: ws, windowEnd: we,
        attemptMode,
        navMode,
        subBabPercentages: percentagesEnabled ? subBabPercentages : undefined,
        questionIds,
      });
      onCreated(newExamId);
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
  const handleSelectAllBab = () => {
    setBabs(availBabs.map(b => b.value));
  };
  const handleSelectAllSubBab = () => {
    setSubBabs(availSubBabs.map(s => s.value));
  };

  const closeAll = () => { setMapelOpen(false); setBabOpen(false); setSubBabOpen(false); setQcOpen(false); setDurOpen(false); };

  const distributeEvenly = () => {
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
  };

  const percentTotal = effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0);
  const chevron = (open: boolean) => (
    <ChevronDown size={15} className={`shrink-0 text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
  );

  return (
    <div className="glass rounded-3xl p-4 sm:p-5">
      {error && (
        <div className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" onClick={closeAll}>
        {/* Title */}
        <div onClick={(e) => e.stopPropagation()}>
          <label htmlFor="scheduled-title" className={ui.label}>Judul ujian</label>
          <input id="scheduled-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
            placeholder="Contoh: Ujian Akhir Semester Genap" className={ui.input} />
        </div>

        {/* Access Code */}
        <div onClick={(e) => e.stopPropagation()}>
          <label htmlFor="scheduled-access-code" className={ui.label}>Kode akses</label>
          <div className="flex gap-2">
            <input id="scheduled-access-code" type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase().slice(0, 20))} required
              placeholder="Contoh: UAS2025EKO" className={`${ui.input} font-mono tracking-wide`} />
            <button
              type="button"
              onClick={generateAccessCode}
              title="Generate kode acak dari judul / mapel"
              className={`${ui.secondary} shrink-0`}
            >
              <Shuffle size={15} className="text-fg-subtle" aria-hidden="true" />
              Acak
            </button>
          </div>
        </div>

        {/* Mapel - Bab - Subbab: horizontal row */}
        <div onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Mapel */}
            <div className="relative">
              <span className={ui.label}>Mapel</span>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={mapelOpen}
                aria-label={`Mapel: ${mapels.length === 0 ? 'Pilih mapel' : mapels.length === 1 ? mapels[0] : `${mapels.length} mapel dipilih`}`}
                onClick={(e) => { e.stopPropagation(); setMapelOpen(v => !v); setBabOpen(false); setSubBabOpen(false); setQcOpen(false); setDurOpen(false); }}
                className={ui.trigger(false)}
              >
                <span className={`truncate text-[14px] font-medium ${mapels.length === 0 ? 'text-fg-subtle' : 'text-fg'}`}>
                  {mapels.length === 0 ? 'Pilih mapel' : mapels.length === 1 ? mapels[0] : `${mapels.length} mapel dipilih`}
                </span>
                {chevron(mapelOpen)}
              </button>
              {mapelOpen && (
                <div className={ui.panel} role="listbox" aria-multiselectable="true">
                  {availMapels.length === 0 ? (
                    <div className="p-3 text-center text-[13px] text-fg-muted">No mapel found</div>
                  ) : availMapels.map(m => {
                    const isSelected = mapels.includes(m.value);
                    return (
                      <button key={m.value} type="button" role="option" aria-selected={isSelected} onClick={() => handleToggleMapel(m.value)} className={ui.option}>
                        <span className={ui.check(isSelected)}>{isSelected && <CheckMark />}</span>
                        <span className={`text-[14px] font-medium ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bab */}
            <div className="relative">
              <span className={ui.label}>Bab</span>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={babOpen}
                aria-label={`Bab: ${babs.length === 0 ? 'Pilih bab' : babs.length === 1 ? babs[0] : `${babs.length} bab dipilih`}`}
                onClick={(e) => { e.stopPropagation(); if (mapels.length === 0) return; setBabOpen(v => !v); setMapelOpen(false); setSubBabOpen(false); setQcOpen(false); setDurOpen(false); }}
                disabled={mapels.length === 0}
                className={ui.trigger(mapels.length === 0)}
              >
                <span className={`truncate text-[14px] font-medium ${babs.length === 0 ? 'text-fg-subtle' : 'text-fg'}`}>
                  {babs.length === 0 ? 'Pilih bab' : babs.length === 1 ? babs[0] : `${babs.length} bab dipilih`}
                </span>
                {chevron(babOpen)}
              </button>
              {babOpen && (
                <div className={ui.panel} role="listbox" aria-multiselectable="true">
                  {availBabs.length === 0 ? (
                    <div className="p-3 text-center text-[13px] text-fg-muted">No bab found</div>
                  ) : (
                    <>
                      <button type="button" onClick={handleSelectAllBab} className={ui.option}>
                        <span className={ui.check(babs.length === availBabs.length)}>{babs.length === availBabs.length && <CheckMark />}</span>
                        <span className="text-[14px] font-semibold text-fg">Pilih semua</span>
                      </button>
                      <div className="my-1 h-px bg-line" aria-hidden="true" />
                      {availBabs.map(b => {
                        const isSelected = babs.includes(b.value);
                        return (
                          <button key={b.value} type="button" role="option" aria-selected={isSelected} onClick={() => handleToggleBab(b.value)} className={ui.option}>
                            <span className={ui.check(isSelected)}>{isSelected && <CheckMark />}</span>
                            <span className={`text-[14px] font-medium ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>{b.label}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Sub-bab */}
            <div className="relative">
              <span className={ui.label}>Sub-bab</span>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={subBabOpen}
                aria-label={`Sub-bab: ${subBabs.length === 0 ? 'Pilih sub-bab' : subBabs.length === 1 ? subBabs[0] : `${subBabs.length} sub-bab dipilih`}`}
                onClick={(e) => { e.stopPropagation(); if (babs.length === 0) return; setSubBabOpen(v => !v); setMapelOpen(false); setBabOpen(false); setQcOpen(false); setDurOpen(false); }}
                disabled={babs.length === 0}
                className={ui.trigger(babs.length === 0)}
              >
                <span className={`truncate text-[14px] font-medium ${subBabs.length === 0 ? 'text-fg-subtle' : 'text-fg'}`}>
                  {subBabs.length === 0 ? 'Pilih sub-bab' : subBabs.length === 1 ? subBabs[0] : `${subBabs.length} sub-bab dipilih`}
                </span>
                {chevron(subBabOpen)}
              </button>
              {subBabOpen && (
                <div className={ui.panel} role="listbox" aria-multiselectable="true">
                  {availSubBabs.length === 0 ? (
                    <div className="p-3 text-center text-[13px] text-fg-muted">No sub-bab found</div>
                  ) : (
                    <>
                      <button type="button" onClick={handleSelectAllSubBab} className={ui.option}>
                        <span className={ui.check(subBabs.length === availSubBabs.length)}>{subBabs.length === availSubBabs.length && <CheckMark />}</span>
                        <span className="text-[14px] font-semibold text-fg">Pilih semua</span>
                      </button>
                      <div className="my-1 h-px bg-line" aria-hidden="true" />
                      {availSubBabs.map(s => {
                        const isSelected = subBabs.includes(s.value);
                        return (
                          <button key={s.value} type="button" role="option" aria-selected={isSelected} onClick={() => handleToggleSubBab(s.value)} className={ui.option}>
                            <span className={ui.check(isSelected)}>{isSelected && <CheckMark />}</span>
                            <span className={`text-[14px] font-medium ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>{s.label}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Persentase soal, below the topic row */}
        {effectiveSubBabs.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <div className="well rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span id="scheduled-percent-label" className="text-[14px] font-semibold text-fg">Persentase soal per sub-bab</span>
                <button
                  type="button"
                  onClick={() => {
                    const newState = !percentagesEnabled;
                    setPercentagesEnabled(newState);
                    if (newState) {
                      distributeEvenly();
                    }
                  }}
                  className="flex h-11 w-14 shrink-0 items-center justify-end"
                  role="switch"
                  aria-checked={percentagesEnabled}
                  aria-labelledby="scheduled-percent-label"
                >
                  <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-calm ${percentagesEnabled ? 'bg-primary' : 'bg-line-strong'}`}>
                    <span
                      aria-hidden="true"
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${percentagesEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </span>
                </button>
              </div>
              {percentagesEnabled && (
                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  {effectiveSubBabs.map(sub => {
                    const label = availSubBabs.find(d => d.value === sub)?.label || sub;
                    return (
                      <div key={sub} className="flex items-center justify-between gap-3">
                        <span className="flex-1 truncate text-[13px] font-medium text-fg">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            aria-label={`Persentase ${label}`}
                            value={subBabPercentages[sub] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setSubBabPercentages(prev => ({ ...prev, [sub]: val }));
                            }}
                            className="h-11 w-16 rounded-lg border border-line-strong bg-transparent text-center text-[14px] font-semibold tabular-nums text-fg transition-calm md:h-10"
                          />
                          <span className="text-[13px] font-semibold text-fg-muted">%</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between border-t border-line pt-2">
                    <button
                      type="button"
                      onClick={distributeEvenly}
                      className="flex h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/10 md:h-10"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Bagi rata
                    </button>
                    <div className="flex items-center gap-2" aria-live="polite">
                      <span className="text-[13px] font-medium text-fg-muted">Total</span>
                      <span className={`text-[14px] font-bold tabular-nums ${percentTotal === 100 ? 'text-primary' : 'text-danger'}`}>
                        {percentTotal}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Question Count + Duration */}
        <div onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-3">
            {/* Question Count */}
            <div className="relative">
              <span className={ui.label}>Jumlah soal</span>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={qcOpen}
                aria-label={`Jumlah soal: ${questionCount} soal`}
                onClick={(e) => { e.stopPropagation(); setQcOpen(v => !v); setMapelOpen(false); setBabOpen(false); setSubBabOpen(false); setDurOpen(false); }}
                className={ui.trigger(false)}
              >
                <span className="text-[14px] font-semibold tabular-nums text-fg">{questionCount} soal</span>
                {chevron(qcOpen)}
              </button>
              {qcOpen && (
                <div className={ui.panel} role="listbox">
                  {QUESTION_COUNT_OPTIONS.map(n => (
                    <button key={n} type="button" role="option" aria-selected={n === questionCount} onClick={() => { setQuestionCount(n); setQcOpen(false); }}
                      className={`${ui.option} text-[14px] font-medium tabular-nums ${n === questionCount ? 'bg-primary/12 font-semibold text-primary' : 'text-fg'}`}>
                      {n} soal
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="relative">
              <span className={ui.label}>Batas waktu</span>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={durOpen}
                aria-label={`Batas waktu: ${timeLimit} menit`}
                onClick={(e) => { e.stopPropagation(); setDurOpen(v => !v); setMapelOpen(false); setBabOpen(false); setSubBabOpen(false); setQcOpen(false); }}
                className={ui.trigger(false)}
              >
                <span className="text-[14px] font-semibold tabular-nums text-fg">{timeLimit} menit</span>
                {chevron(durOpen)}
              </button>
              {durOpen && (
                <div className={ui.panel} role="listbox">
                  {DURATION_OPTIONS.map(m => (
                    <button key={m} type="button" role="option" aria-selected={m === timeLimit} onClick={() => { setTimeLimit(m); setDurOpen(false); }}
                      className={`${ui.option} text-[14px] font-medium tabular-nums ${m === timeLimit ? 'bg-primary/12 font-semibold text-primary' : 'text-fg'}`}>
                      {m} menit
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attempt Mode */}
        <div onClick={(e) => e.stopPropagation()}>
          <span className={ui.label}>Mode percobaan</span>
          <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Mode percobaan">
            <button type="button" aria-pressed={attemptMode === 'single'} onClick={() => setAttemptMode('single')} className={ui.segment(attemptMode === 'single')}>
              Sekali
            </button>
            <button type="button" aria-pressed={attemptMode === 'retake'} onClick={() => setAttemptMode('retake')} className={ui.segment(attemptMode === 'retake')}>
              Retake
            </button>
          </div>
          <p className={ui.hint}>
            {attemptMode === 'single'
              ? 'Peserta hanya bisa mengerjakan 1x. Nilai final langsung disimpan.'
              : 'Peserta bisa mengerjakan berulang kali. Yang dihitung adalah nilai tertinggi.'}
          </p>
        </div>

        {/* Nav Mode */}
        <div onClick={(e) => e.stopPropagation()}>
          <span className={ui.label}>Mode navigasi</span>
          <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Mode navigasi">
            <button type="button" aria-pressed={navMode === 'strict'} onClick={() => setNavMode('strict')} className={ui.segment(navMode === 'strict')}>
              Strict
            </button>
            <button type="button" aria-pressed={navMode === 'standard'} onClick={() => setNavMode('standard')} className={ui.segment(navMode === 'standard')}>
              Standard
            </button>
          </div>
          <p className={ui.hint}>
            {navMode === 'strict' ? 'Soal harus dikerjakan berurutan, tidak bisa kembali.' : 'Peserta bisa bolak-balik soal dan menandai ragu-ragu.'}
          </p>
        </div>

        {/* Window Start / End: date + time inputs */}
        <div onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className={ui.label}>Waktu mulai</span>
              <div className="flex gap-2">
                <input
                  type="date"
                  aria-label="Tanggal mulai"
                  value={windowStart ? windowStart.split('T')[0] : ''}
                  onChange={(e) => setWindowStart(prev => {
                    const t = prev ? prev.split('T')[1]?.slice(0, 5) : '00:00';
                    return `${e.target.value}T${t}`;
                  })}
                  required
                  className={`${ui.input} flex-1 px-2.5`}
                />
                <input
                  type="time"
                  aria-label="Jam mulai"
                  value={windowStart ? windowStart.split('T')[1]?.slice(0, 5) : '00:00'}
                  onChange={(e) => setWindowStart(prev => {
                    const d = prev ? prev.split('T')[0] : new Date().toISOString().split('T')[0];
                    return `${d}T${e.target.value}`;
                  })}
                  required
                  className={`${ui.input} w-28 px-2.5 tabular-nums`}
                />
              </div>
            </div>
            <div>
              <span className={ui.label}>Waktu selesai</span>
              <div className="flex gap-2">
                <input
                  type="date"
                  aria-label="Tanggal selesai"
                  value={windowEnd ? windowEnd.split('T')[0] : ''}
                  onChange={(e) => setWindowEnd(prev => {
                    const t = prev ? prev.split('T')[1]?.slice(0, 5) : '23:59';
                    return `${e.target.value}T${t}`;
                  })}
                  required
                  className={`${ui.input} flex-1 px-2.5`}
                />
                <input
                  type="time"
                  aria-label="Jam selesai"
                  value={windowEnd ? windowEnd.split('T')[1]?.slice(0, 5) : '23:59'}
                  onChange={(e) => setWindowEnd(prev => {
                    const d = prev ? prev.split('T')[0] : new Date().toISOString().split('T')[0];
                    return `${d}T${e.target.value}`;
                  })}
                  required
                  className={`${ui.input} w-28 px-2.5 tabular-nums`}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="clay-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
        >
          {saving && <span className="spinner-calm h-4 w-4" aria-hidden="true" />}
          {saving ? 'Menyimpan...' : 'Buat ujian'}
        </button>
      </form>
    </div>
  );
}

/* ---------- AttemptsPanel ---------- */

function AttemptsPanel({ examId, examTitle, onBack }: {
  examId: string; examTitle: string; onBack: () => void;
}) {
  const [attempts, setAttempts] = useState<ScheduledExamAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getAdminAccessToken()
      .then((t) => listScheduledExamAttemptsAction(t, examId))
      .then((data) => { setAttempts(data); setLoading(false); });
  }, [examId]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className={ui.secondary}>
        <ArrowLeft size={15} className="text-fg-subtle" aria-hidden="true" />
        Kembali
      </button>
      <div className="glass rounded-3xl px-4 py-4 sm:px-5">
        <p className="text-[12px] font-medium text-fg-muted">Peserta</p>
        <h2 className="mt-0.5 text-[20px] font-bold tracking-tight text-fg">
          {examTitle}
        </h2>
        <p className="mt-0.5 text-[13px] tabular-nums text-fg-muted">
          {attempts.length} peserta
        </p>
      </div>

      {loading ? (
        <div className="glass flex items-center justify-center gap-2 rounded-3xl py-10 text-[13px] font-medium text-fg-muted" role="status">
          <span className="spinner-calm h-4 w-4" aria-hidden="true" />
          Memuat...
        </div>
      ) : attempts.length === 0 ? (
        <div className="glass rounded-3xl px-4 py-10 text-center">
          <p className="text-[14px] font-semibold text-fg">Belum ada peserta.</p>
          <p className="mt-1 text-[13px] text-fg-muted">Peserta muncul di sini setelah mereka masuk dengan kode akses.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-3xl">
          {attempts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-fg">
                  {a.student_name}
                </p>
                <p className="text-[12px] tabular-nums text-fg-muted">
                  {formatDateTime(a.started_at)}
                  {a.auto_submitted && <span className="ml-2 font-semibold text-highlight-fg">(auto-submit)</span>}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {a.submitted_at ? (
                  <span className="clay inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-[15px] font-bold tabular-nums">
                    {a.score ?? '-'}
                  </span>
                ) : (
                  <span className="inline-flex h-7 items-center rounded-lg bg-primary/12 px-2.5 text-[12px] font-semibold text-primary">
                    Sedang mengerjakan
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
