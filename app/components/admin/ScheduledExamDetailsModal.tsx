"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, Users, X } from 'lucide-react';
import { type ScheduledExamRow, type ScheduledExamAttemptRow } from '@/app/actions/admin/scheduled-exam';
import { fetchAttemptAnswersAction, type AttemptDetailsResult } from '@/app/actions/admin/scheduled-exam-answers';
import { type RawQuestion } from '@/lib/questions';
import ResultDetailsModal from '@/app/components/admin/ResultDetailsModal';
import ScheduledExamQuestionsModal from '@/app/components/admin/ScheduledExamQuestionsModal';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';
import { scrimMotion, sheetMotion } from '@/app/components/ui/motion-presets';

type ScheduledExamDetailsModalProps = {
  exam: ScheduledExamRow | null;
  attempts: ScheduledExamAttemptRow[];
  attemptLoading: boolean;
  detailQuestions: RawQuestion[];
  detailLoading: boolean;
  formatCategorySelectionLabel: (value?: string | null) => string;
  getCorrectOptionText: (question: RawQuestion) => string;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

function splitCategoryValues(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function formatCategoryChip(value: string | string[] | null | undefined, formatCategorySelectionLabel: (value?: string | null) => string) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  const values = Array.isArray(value) ? value : splitCategoryValues(value);
  if (values.length === 0) return null;
  const label = formatCategorySelectionLabel(values[0]);
  return values.length > 1 ? `${label} +${values.length - 1}` : label;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Makassar',
  });
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

function formatDuration(startedAt: string, endedAt: string | null, deadlineAt: string | null, autoSubmitted: boolean): string {
  // If we have an explicit end time (submitted), use it.
  // Otherwise, if auto-submitted by sweeper, use deadline.
  // Fallback to now for in-progress.
  const end = endedAt ?? (autoSubmitted && deadlineAt ? deadlineAt : new Date().toISOString());
  const start = new Date(startedAt).getTime();
  const endMs = new Date(end).getTime();
  const diffSec = Math.floor((endMs - start) / 1000);
  if (diffSec < 0) return '-';
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m ${seconds}d`;
}

const chip = 'well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold text-fg-muted';

export default function ScheduledExamDetailsModal({
  exam,
  attempts,
  attemptLoading,
  detailQuestions,
  detailLoading,
  formatCategorySelectionLabel,
  getCorrectOptionText,
  onClose,
  theme = 'dark',
}: ScheduledExamDetailsModalProps) {
  const [questionsModalOpen, setQuestionsModalOpen] = useState(false);
  const [viewingAttempt, setViewingAttempt] = useState<ScheduledExamAttemptRow | null>(null);
  const [attemptDetails, setAttemptDetails] = useState<AttemptDetailsResult | null>(null);
  const [attemptDetailsLoading, setAttemptDetailsLoading] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (exam) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [exam]);

  // Escape closes this modal only when no nested modal (questions, answers) is on top of it.
  useEffect(() => {
    if (!exam || questionsModalOpen || viewingAttempt) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exam, questionsModalOpen, viewingAttempt, onClose]);

  const handleCloseQuestions = () => setQuestionsModalOpen(false);
  const handleCloseResult = () => {
    setViewingAttempt(null);
    setAttemptDetails(null);
  };

  const handleViewAttempt = async (attempt: ScheduledExamAttemptRow) => {
    setViewingAttempt(attempt);
    setAttemptDetails(null);
    setAttemptDetailsLoading(true);
    try {
      const token = await getAdminAccessToken();
      const details = await fetchAttemptAnswersAction(token, attempt.id);
      setAttemptDetails(details);
    } catch (e) {
      console.error('Failed to load attempt answers', e);
    } finally {
      setAttemptDetailsLoading(false);
    }
  };

  // Sort attempts: score DESC, time ASC
  const sortedAttempts = [...attempts].sort((a, b) => {
    const scoreA = a.score ?? 0;
    const scoreB = b.score ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const timeA = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity;
    const timeB = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity;
    return timeA - timeB;
  });

  const activeCount = attempts.filter(a => !a.submitted_at).length;

  return (
    <>
      <AnimatePresence>
        {exam && (
          <motion.div
            {...scrimMotion}
            data-theme={theme}
            className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4"
            onClick={onClose}
          >
            <motion.div
              {...sheetMotion}
              role="dialog"
              aria-modal="true"
              aria-labelledby="scheduled-detail-title"
              className="glass-sheet flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-4xl text-fg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-fg-muted">Ujian terjadwal</p>
                  <h2 id="scheduled-detail-title" className="mt-0.5 truncate text-[20px] font-bold tracking-tight text-fg">
                    {exam.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={exam.status} />
                    {exam.access_code && (
                      <span className={`${chip} font-mono tracking-wide text-fg`}>
                        {exam.access_code}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup"
                  className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body, two columns from lg */}
              <div className="flex-1 overflow-y-auto">
                <div className="flex min-h-full flex-col lg:flex-row">

                  {/* Left: exam info + question bank */}
                  <div className="w-full shrink-0 space-y-3 border-b border-line px-5 py-4 sm:px-6 lg:w-80 lg:border-b-0 lg:border-r">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[exam.mapels, exam.babs, exam.sub_babs].map((value, index) => {
                        const label = value ? formatCategoryChip(value, formatCategorySelectionLabel) : null;
                        return label ? <span key={index} className={chip}>{label}</span> : null;
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="clay inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-bold tabular-nums">
                        {exam.question_count} soal
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuestionsModalOpen(true)}
                        disabled={detailLoading}
                        className="flex h-11 items-center gap-2 rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18 disabled:opacity-60 md:h-10"
                      >
                        {detailLoading && <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />}
                        {detailLoading ? 'Memuat soal…' : 'Lihat soal'}
                      </button>
                    </div>

                    <div className="well space-y-2.5 rounded-2xl p-4">
                      <DetailRow label="Batas waktu" value={`${exam.time_limit_minutes} menit`} />
                      <DetailRow label="Mode percobaan" value={exam.attempt_mode === 'retake' ? 'Retake' : 'Sekali'} />
                      <DetailRow label="Mode navigasi" value={exam.nav_mode === 'strict' ? 'Strict' : 'Standard'} />
                      <DetailRow label="Waktu mulai" value={formatDateTime(exam.window_start)} />
                      <DetailRow label="Waktu selesai" value={formatDateTime(exam.window_end)} />
                    </div>
                  </div>

                  {/* Right: player table */}
                  <div className="min-w-0 flex-1 px-5 py-4 sm:px-6">
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-[15px] font-bold tracking-tight text-fg">
                        Peserta
                      </h3>
                      {!attemptLoading && (
                        <>
                          <span className="well inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold tabular-nums text-fg-muted">
                            {attempts.length}
                          </span>
                          {activeCount > 0 && (
                            <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-primary/12 px-2 text-[12px] font-semibold text-primary">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
                              {activeCount} aktif
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {attemptLoading ? (
                      <div className="space-y-2" role="status" aria-label="Memuat peserta">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="well h-12 animate-pulse rounded-2xl" />
                        ))}
                      </div>
                    ) : attempts.length === 0 ? (
                      <div className="well flex flex-col items-center justify-center rounded-2xl py-10 text-center">
                        <Users size={26} className="mb-2 text-fg-subtle" aria-hidden="true" />
                        <p className="text-[14px] font-semibold text-fg">Belum ada peserta</p>
                        <p className="mt-1 text-[13px] text-fg-muted">Peserta muncul setelah masuk dengan kode akses.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-line text-left text-[12px] font-semibold text-fg-muted">
                              <th className="pb-2 pr-3">Rank</th>
                              <th className="pb-2 pr-3">Nama</th>
                              <th className="pb-2 pr-3">Soal aktif</th>
                              <th className="pb-2 pr-3">Skor</th>
                              <th className="pb-2 pr-3">Waktu</th>
                              <th className="pb-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedAttempts.map((attempt, idx) => (
                              <tr key={attempt.id} className="border-b border-line last:border-b-0">
                                <td className="py-2.5 pr-3">
                                  <span className="clay inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold tabular-nums">
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="max-w-[160px] truncate py-2.5 pr-3 text-[14px] font-semibold text-fg">
                                  {attempt.student_name}
                                </td>
                                <td className="py-2.5 pr-3 text-[13px] tabular-nums text-fg-muted">
                                  {attempt.submitted_at
                                    ? '-'
                                    : attempt.current_question_index != null
                                      ? `Q${attempt.current_question_index + 1}`
                                      : 'Q1'}
                                </td>
                                <td className="py-2.5 pr-3 text-[14px] font-bold tabular-nums text-fg">
                                  {attempt.submitted_at
                                    ? (attempt.score != null ? attempt.score : '-')
                                    : (attempt.live_score != null ? attempt.live_score : '0')}
                                </td>
                                <td className="py-2.5 pr-3 text-[13px] tabular-nums text-fg-muted">
                                  {formatDuration(attempt.started_at, attempt.submitted_at, attempt.deadline_at, attempt.auto_submitted)}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => void handleViewAttempt(attempt)}
                                    className="well well-hover h-11 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-medium text-fg transition-calm md:h-10"
                                  >
                                    Lihat jawaban
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions modal */}
      <ScheduledExamQuestionsModal
        isOpen={questionsModalOpen}
        questions={detailQuestions}
        getCorrectOptionText={getCorrectOptionText}
        onClose={handleCloseQuestions}
        theme={theme}
      />

      {/* Per-player result details modal */}
      {viewingAttempt && exam && (
        <ResultDetailsModal
          viewingResult={{
            name: viewingAttempt.student_name,
            mapel: (exam.mapels ?? []).join(', '),
            bab: (exam.babs ?? []).join(', '),
            sub_bab: (exam.sub_babs ?? []).join(', '),
            score: attemptDetails?.score ?? viewingAttempt.score ?? 0,
            total_questions: exam.question_count,
            user_answers: attemptDetails?.user_answers?.map(a => ({
              question_id: a.question_id,
              user_answer: a.user_answer ?? '',
              is_correct: a.is_correct,
            })),
            start_time: attemptDetails?.started_at ?? viewingAttempt.started_at,
            end_time: attemptDetails?.submitted_at ?? viewingAttempt.submitted_at ?? undefined,
          }}
          detailLoading={attemptDetailsLoading}
          detailQuestions={detailQuestions}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          getCorrectOptionText={getCorrectOptionText}
          onClose={handleCloseResult}
          theme={theme}
        />
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-fg-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold tabular-nums text-fg">{value}</span>
    </div>
  );
}
