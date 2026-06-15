'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle2, Clock, XCircle, Users, CalendarClock, TrendingUp, Users2, Percent } from 'lucide-react';
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
import { fetchAllMapelsAdmin, fetchBabsAdmin, fetchSubBabsAdmin, QUESTION_COUNTS } from '@/lib/questions';
import type { BabInfo, SubBabInfo } from '@/lib/questions';

type Props = {
  theme: 'light' | 'dark';
};

type ActiveView = 'create' | 'manage' | 'history';
type ViewState =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'attempts'; examId: string; examTitle: string };

const cardCls = (t: 'light' | 'dark') =>
  t === 'dark'
    ? 'rounded-[20px] border border-dark-border-subtle bg-dark-800 p-5'
    : 'rounded-[20px] border border-[#e5e5e5] bg-white p-5';

const inputCls = (t: 'light' | 'dark') =>
  `w-full h-10 rounded-xl px-3 text-[13px] font-medium outline-none transition-spring-fast ${
    t === 'dark'
      ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium focus:border-accent-blue placeholder:text-dark-text-muted'
      : 'bg-[#f5f5f5] text-[#111111] border border-[#e5e5e5] focus:border-[#111111] placeholder:text-gray-400'
  }`;

const selectCls = (t: 'light' | 'dark') =>
  `w-full h-10 rounded-xl px-3 text-[13px] font-medium outline-none appearance-none transition-spring-fast ${
    t === 'dark'
      ? 'bg-dark-700 text-dark-text-primary border border-dark-border-medium focus:border-accent-blue'
      : 'bg-[#f5f5f5] text-[#111111] border border-[#e5e5e5] focus:border-[#111111]'
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

export default function ScheduledExamTabPanel({ theme }: Props) {
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
      void loadHistory();
    } else {
      void loadExams();
    }
  }, [activeView, loadExams, loadHistory]);

  if (view.kind === 'create') {
    return (
      <CreateExamForm
        theme={theme}
        onCreated={() => { setView({ kind: 'list' }); void loadExams(); }}
        onCancel={() => setView({ kind: 'list' })}
      />
    );
  }

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
          {activeView === 'create' && (
            <button
              type="button"
              onClick={() => setView({ kind: 'create' })}
              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold transition-spring-fast active:scale-95 ${
                t === 'dark'
                  ? 'bg-accent-blue text-white hover:bg-accent-blue/80'
                  : 'bg-[#111111] text-white hover:bg-[#333333]'
              }`}
            >
              <Plus size={14} /> Buat ujian
            </button>
          )}
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
          {/* Create view: header card + form card */}
          {activeView === 'create' && (
            <div className="min-h-0 flex-1">
              <div className="mx-auto max-w-2xl">
                <div className={`mb-3 rounded-[20px] border p-4 shadow-ios-sm ${t === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-[#e5e5e5] bg-white'}`}>
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
                  onCreated={() => void loadExams()}
                />
              </div>
            </div>
          )}

          {/* Manage view: list + Publish/Tutup/Peserta */}
          {activeView === 'manage' && exams.length === 0 && (
            <div className={`text-center py-12 ${t === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
              <CalendarClock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[13px] font-medium">Belum ada ujian terjadwal.</p>
            </div>
          )}

          {activeView === 'manage' && exams.length > 0 && (
            <div className="space-y-3">
              {exams.map((exam) => (
                <div key={exam.id} className={cardCls(theme)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14px] font-bold truncate ${t === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>
                          {exam.title}
                        </h3>
                        <StatusBadge status={exam.status} />
                      </div>
                      {exam.access_code && (
                        <p className={`text-[12px] font-mono ${t === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
                          Kode: {exam.access_code}
                        </p>
                      )}
                      <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] ${t === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
                        <span>{exam.question_count} soal</span>
                        <span>{exam.time_limit_minutes} menit</span>
                        <span>{formatDateTime(exam.window_start)} - {formatDateTime(exam.window_end)}</span>
                        <span>{exam.attempt_mode === 'single' ? 'Sekali' : 'Retake'}</span>
                        <span>{exam.mode}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {exam.status === 'draft' && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const token = await getAdminAccessToken();
                              await publishScheduledExamAction(token, exam.id);
                              void loadExams();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Gagal publish');
                            }
                          }}
                          className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-spring-fast active:scale-95 ${
                            t === 'dark'
                              ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
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
                              void loadExams();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Gagal tutup');
                            }
                          }}
                          className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-spring-fast active:scale-95 ${
                            t === 'dark'
                              ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          Tutup
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setView({ kind: 'attempts', examId: exam.id, examTitle: exam.title })}
                        className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-spring-fast active:scale-95 ${
                          t === 'dark'
                            ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10'
                            : 'bg-black/5 text-gray-600 hover:bg-black/10'
                        }`}
                      >
                        <Users size={12} className="inline mr-1" />
                        Peserta
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History view */}
          {activeView === 'history' && history.length === 0 && (
            <div className={`text-center py-12 ${t === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
              <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[13px] font-medium">Belum ada ujian yang sudah ditutup.</p>
            </div>
          )}

          {activeView === 'history' && history.length > 0 && (
            <div className="space-y-3">
              {history.map((exam) => (
                <div key={exam.id} className={cardCls(theme)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-[14px] font-bold truncate ${t === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>
                          {exam.title}
                        </h3>
                        <StatusBadge status={exam.status} />
                      </div>
                      {exam.access_code && (
                        <p className={`text-[12px] font-mono ${t === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
                          Kode: {exam.access_code}
                        </p>
                      )}
                      <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] ${t === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
                        <span>{exam.question_count} soal</span>
                        <span>{exam.time_limit_minutes} menit</span>
                        <span>{formatDateTime(exam.window_start)} - {formatDateTime(exam.window_end)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                          <Users2 size={12} className={t === 'dark' ? 'text-dark-text-secondary' : 'text-gray-400'} />
                          <span className={t === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}>
                            {exam.participant_count}
                          </span>
                        </div>
                      </div>
                      {exam.avg_score != null && (
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                            <TrendingUp size={12} className={t === 'dark' ? 'text-dark-text-secondary' : 'text-gray-400'} />
                            <span className={t === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}>
                              avg {exam.avg_score}
                            </span>
                          </div>
                        </div>
                      )}
                      {exam.pass_rate != null && (
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                            <Percent size={12} className={t === 'dark' ? 'text-dark-text-secondary' : 'text-gray-400'} />
                            <span className={t === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}>
                              pass {exam.pass_rate}%
                            </span>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setView({ kind: 'attempts', examId: exam.id, examTitle: exam.title })}
                        className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-spring-fast active:scale-95 ${
                          t === 'dark'
                            ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10'
                            : 'bg-black/5 text-gray-600 hover:bg-black/10'
                        }`}
                      >
                        <Users size={12} className="inline mr-1" />
                        Peserta
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Create Exam Form Card (inline, no sub-view) */

function CreateFormCard({ theme, onCreated }: {
  theme: 'light' | 'dark'; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [mode, setMode] = useState<'exam' | 'survival'>('exam');
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void fetchAllMapelsAdmin().then(setAvailMapels); }, []);

  useEffect(() => {
    if (mapels.length > 0) {
      void fetchBabsAdmin(mapels.length === 1 ? mapels[0] : undefined).then(setAvailBabs);
    } else { setAvailBabs([]); }
    setBabs([]); setSubBabs([]);
  }, [mapels]);

  useEffect(() => {
    if (babs.length > 0) {
      void fetchSubBabsAdmin(babs.length === 1 ? babs[0] : undefined).then(setAvailSubBabs);
    } else { setAvailSubBabs([]); }
    setSubBabs([]);
  }, [babs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const token = await getAdminAccessToken();
      await createScheduledExamAction(token, {
        title, accessCode, mapels, babs, subBabs,
        mode, questionCount, timeLimitMinutes: timeLimit,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
        attemptMode,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat ujian');
    } finally { setSaving(false); }
  };

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const chipCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-medium transition-spring-fast ${
      active
        ? theme === 'dark' ? 'bg-accent-blue text-white' : 'bg-[#111111] text-white'
        : theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'
    }`;

  return (
    <div className={`overflow-hidden rounded-[24px] border shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-[#e5e5e5] bg-white'}`}>
      <div className="p-5">
        {error && (
          <div className={`mb-4 rounded-2xl p-3 text-[13px] font-medium ${theme === 'dark' ? 'bg-accent-red/10 text-accent-red' : 'bg-red-50 text-red-600'}`}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Judul ujian</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
              placeholder="Contoh: Ujian Akhir Semester Genap" className={inputCls(theme)} />
          </div>

          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Kode akses</label>
            <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase().slice(0, 20))} required
              placeholder="Contoh: UAS2025EKO" className={inputCls(theme)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as 'exam' | 'survival')} className={selectCls(theme)}>
                <option value="exam">Exam</option>
                <option value="survival">Survival</option>
              </select>
            </div>
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Jumlah soal</label>
              <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className={selectCls(theme)}>
                {QUESTION_COUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Batas waktu (menit)</label>
              <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} max={300} required className={inputCls(theme)} />
            </div>
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mode percobaan</label>
              <select value={attemptMode} onChange={(e) => setAttemptMode(e.target.value as 'single' | 'retake')} className={selectCls(theme)}>
                <option value="single">Sekali</option>
                <option value="retake">Retake</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Window mulai</label>
              <input type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} required className={inputCls(theme)} />
            </div>
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Window selesai</label>
              <input type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} required className={inputCls(theme)} />
            </div>
          </div>

          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mapel</label>
            <div className="flex flex-wrap gap-1.5">
              {availMapels.map((m) => (
                <button key={m.value} type="button" onClick={() => toggleItem(mapels, setMapels, m.value)} className={chipCls(mapels.includes(m.value))}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {availBabs.length > 0 && (
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>BAB</label>
              <div className="flex flex-wrap gap-1.5">
                {availBabs.map((b) => (
                  <button key={b.value} type="button" onClick={() => toggleItem(babs, setBabs, b.value)} className={chipCls(babs.includes(b.value))}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availSubBabs.length > 0 && (
            <div>
              <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Sub-bab</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {availSubBabs.map((s) => (
                  <button key={s.value} type="button" onClick={() => toggleItem(subBabs, setSubBabs, s.value)} className={chipCls(subBabs.includes(s.value))}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className={`w-full h-11 rounded-2xl text-[14px] font-semibold transition-spring-fast active:scale-95 disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-accent-blue text-white hover:bg-accent-blue/80'
                : 'bg-[#111111] text-white hover:bg-[#333333]'
            }`}
          >
            {saving ? 'Menyimpan...' : 'Buat ujian'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* Create Exam Form (legacy sub-view, kept for back compat from list view) */

function CreateExamForm({ theme, onCreated, onCancel }: {
  theme: 'light' | 'dark'; onCreated: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [mode, setMode] = useState<'exam' | 'survival'>('exam');
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void fetchAllMapelsAdmin().then(setAvailMapels); }, []);

  useEffect(() => {
    if (mapels.length > 0) {
      void fetchBabsAdmin(mapels.length === 1 ? mapels[0] : undefined).then(setAvailBabs);
    } else { setAvailBabs([]); }
    setBabs([]); setSubBabs([]);
  }, [mapels]);

  useEffect(() => {
    if (babs.length > 0) {
      void fetchSubBabsAdmin(babs.length === 1 ? babs[0] : undefined).then(setAvailSubBabs);
    } else { setAvailSubBabs([]); }
    setSubBabs([]);
  }, [babs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const token = await getAdminAccessToken();
      await createScheduledExamAction(token, {
        title, accessCode, mapels, babs, subBabs,
        mode, questionCount, timeLimitMinutes: timeLimit,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
        attemptMode,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat ujian');
    } finally { setSaving(false); }
  };

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const chipCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-medium transition-spring-fast ${
      active
        ? theme === 'dark' ? 'bg-accent-blue text-white' : 'bg-[#111111] text-white'
        : theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'
    }`;

  return (
    <div className="max-w-xl">
      <button type="button" onClick={onCancel} className={`mb-4 text-[13px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary hover:text-dark-text-primary' : 'text-gray-500 hover:text-gray-900'}`}>
        &larr; Kembali
      </button>
      <h2 className={`text-lg font-bold tracking-tight mb-4 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>
        Buat ujian terjadwal
      </h2>

      {error && (
        <div className={`mb-4 rounded-2xl p-3 text-[13px] font-medium ${theme === 'dark' ? 'bg-accent-red/10 text-accent-red' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Judul ujian</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
            placeholder="Contoh: Ujian Akhir Semester Genap" className={inputCls(theme)} />
        </div>

        <div>
          <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Kode akses</label>
          <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase().slice(0, 20))} required
            placeholder="Contoh: UAS2025EKO" className={inputCls(theme)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as 'exam' | 'survival')} className={selectCls(theme)}>
              <option value="exam">Exam</option>
              <option value="survival">Survival</option>
            </select>
          </div>
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Jumlah soal</label>
            <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className={selectCls(theme)}>
              {QUESTION_COUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Batas waktu (menit)</label>
            <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} max={300} required className={inputCls(theme)} />
          </div>
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mode percobaan</label>
            <select value={attemptMode} onChange={(e) => setAttemptMode(e.target.value as 'single' | 'retake')} className={selectCls(theme)}>
              <option value="single">Sekali</option>
              <option value="retake">Retake</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Window mulai</label>
            <input type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} required className={inputCls(theme)} />
          </div>
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Window selesai</label>
            <input type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} required className={inputCls(theme)} />
          </div>
        </div>

        <div>
          <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mapel</label>
          <div className="flex flex-wrap gap-1.5">
            {availMapels.map((m) => (
              <button key={m.value} type="button" onClick={() => toggleItem(mapels, setMapels, m.value)} className={chipCls(mapels.includes(m.value))}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {availBabs.length > 0 && (
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>BAB</label>
            <div className="flex flex-wrap gap-1.5">
              {availBabs.map((b) => (
                <button key={b.value} type="button" onClick={() => toggleItem(babs, setBabs, b.value)} className={chipCls(babs.includes(b.value))}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {availSubBabs.length > 0 && (
          <div>
            <label className={`block text-[12px] font-semibold mb-1.5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Sub-bab</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {availSubBabs.map((s) => (
                <button key={s.value} type="button" onClick={() => toggleItem(subBabs, setSubBabs, s.value)} className={chipCls(subBabs.includes(s.value))}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className={`w-full h-11 rounded-2xl text-[14px] font-semibold transition-spring-fast active:scale-95 disabled:opacity-50 ${
            theme === 'dark'
              ? 'bg-accent-blue text-white hover:bg-accent-blue/80'
              : 'bg-[#111111] text-white hover:bg-[#333333]'
          }`}
        >
          {saving ? 'Menyimpan...' : 'Buat ujian'}
        </button>
      </form>
    </div>
  );
}

/* Attempts Panel */

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
      <h2 className={`text-lg font-bold tracking-tight mb-1 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>
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
              <div key={a.id} className={`flex items-center justify-between py-2 border-b last:border-b-0 ${theme === 'dark' ? 'border-dark-border-subtle' : 'border-[#f0f0f0]'}`}>
                <div>
                  <p className={`text-[13px] font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>
                    {a.student_name}
                  </p>
                  <p className={`text-[11px] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-gray-400'}`}>
                    {formatDateTime(a.started_at)}
                    {a.auto_submitted && <span className="ml-2 text-orange-500">(auto-submit)</span>}
                  </p>
                </div>
                <div className="text-right">
                  {a.submitted_at ? (
                    <span className={`text-[14px] font-bold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>
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
