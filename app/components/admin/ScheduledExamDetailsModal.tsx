"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, Users } from 'lucide-react';
import { type ScheduledExamRow, type ScheduledExamAttemptRow } from '@/app/actions/admin/scheduled-exam';
import { fetchAttemptAnswersAction, type AttemptDetailsResult } from '@/app/actions/admin/scheduled-exam-answers';
import { type RawQuestion } from '@/lib/questions';
import ResultDetailsModal from '@/app/components/admin/ResultDetailsModal';
import ScheduledExamQuestionsModal from '@/app/components/admin/ScheduledExamQuestionsModal';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';

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

function StatusBadge({ status, theme = 'dark' }: { status: string; theme?: 'light' | 'dark' }) {
  const isDark = theme === 'dark';
  const map: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
    scheduled: { icon: <Clock size={12} />, bg: isDark ? 'bg-accent-blue/15' : 'bg-blue-50', text: isDark ? 'text-accent-blue' : 'text-blue-600' },
    active: { icon: <CheckCircle2 size={12} />, bg: isDark ? 'bg-accent-green/15' : 'bg-green-50', text: isDark ? 'text-accent-green' : 'text-green-600' },
    expired: { icon: <XCircle size={12} />, bg: isDark ? 'bg-accent-red/15' : 'bg-red-50', text: isDark ? 'text-accent-red' : 'text-red-600' },
  };
  const entry = map[status] || map.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.bg} ${entry.text}`}>
      {entry.icon} {status}
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

  const isDark = theme === 'dark';

  // Lock body scroll when modal is open
  useEffect(() => {
    if (exam) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [exam]);

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

  return (
    <>
      <AnimatePresence>
        {exam && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
              onClick={onClose}
            >
              {/* Panel — wider for player table */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`rounded-[24px] shadow-ios-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-dark-800 border border-dark-border-subtle' : 'bg-white border border-nike-grey-200'}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className={`shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b sm:gap-4 ${isDark ? 'border-dark-border-subtle' : 'border-nike-grey-200'}`}>
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <h2 className={`text-[15px] font-semibold tracking-tight truncate ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                      {exam.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={exam.status} theme={theme} />
                      {exam.access_code && (
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold ${isDark ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700'}`}>
                          {exam.access_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${isDark ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Body — two-column layout */}
                <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-dark-800' : 'bg-white'}`}>
                  <div className="flex flex-col lg:flex-row min-h-full">

                    {/* Left panel: exam info + question bank */}
                    <div className={`w-full lg:w-72 shrink-0 px-5 py-4 space-y-3 border-b lg:border-b-0 lg:border-r ${isDark ? 'border-dark-border-subtle' : 'border-nike-grey-200'}`}>
                      {/* Category chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {exam.mapels && (() => {
                          const chip = formatCategoryChip(exam.mapels!, formatCategorySelectionLabel);
                          return chip ? (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${isDark ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                              {chip}
                            </span>
                          ) : null;
                        })()}
                        {exam.babs && (() => {
                          const chip = formatCategoryChip(exam.babs!, formatCategorySelectionLabel);
                          return chip ? (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${isDark ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                              {chip}
                            </span>
                          ) : null;
                        })()}
                        {exam.sub_babs && (() => {
                          const chip = formatCategoryChip(exam.sub_babs!, formatCategorySelectionLabel);
                          return chip ? (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${isDark ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                              {chip}
                            </span>
                          ) : null;
                        })()}
                      </div>

                      {/* Question count chip + Questions button */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${isDark ? 'bg-accent-purple/15 text-accent-purple' : 'bg-purple-50 text-purple-700'}`}>
                          {exam.question_count} Soal
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuestionsModalOpen(true)}
                          className={`h-8 rounded-full px-3 text-[11px] font-semibold transition-spring-fast active:scale-95 ${isDark ? 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                        >
                          Questions
                        </button>
                      </div>

                      {/* Detail grid */}
                      <div className={`rounded-2xl border p-4 space-y-2.5 ${isDark ? 'border-dark-border-subtle bg-white/[0.02]' : 'border-nike-grey-200 bg-black/[0.02]'}`}>
                        <DetailRow label="Batas waktu" value={`${exam.time_limit_minutes} menit`} theme={theme} />
                        <DetailRow
                          label="Mode percobaan"
                          value={exam.attempt_mode === 'retake' ? 'Retake' : 'Sekali'}
                          theme={theme}
                        />
                        <DetailRow
                          label="Mode navigasi"
                          value={exam.nav_mode === 'strict' ? 'Strict' : 'Standard'}
                          theme={theme}
                        />
                        <DetailRow label="Waktu Mulai" value={formatDateTime(exam.window_start)} theme={theme} />
                        <DetailRow label="Waktu Selesai" value={formatDateTime(exam.window_end)} theme={theme} />
                      </div>
                    </div>

                    {/* Right panel: player table */}
                    <div className="flex-1 px-5 py-4 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className={`text-[13px] font-semibold ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                          Player
                        </h3>
                        {!attemptLoading && (
                          <>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-500'}`}>
                              {attempts.length}
                            </span>
                            {attempts.filter(a => !a.submitted_at).length > 0 && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isDark ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700'
                              }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                {attempts.filter(a => !a.submitted_at).length} aktif
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {attemptLoading ? (
                        /* Skeleton rows */
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className={`h-12 rounded-2xl animate-pulse ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />
                          ))}
                        </div>
                      ) : attempts.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-10 text-center ${isDark ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                          <Users size={28} className="mb-2 opacity-40" />
                          <p className="text-[12px] font-medium">Belum ada peserta</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className={`text-left text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                                <th className="pb-2 pr-3">Rank</th>
                                <th className="pb-2 pr-3">Nama</th>
                                <th className="pb-2 pr-3">Current</th>
                                <th className="pb-2 pr-3">Score</th>
                                <th className="pb-2 pr-3">Waktu</th>
                                <th className="pb-2">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {sortedAttempts.map((attempt, idx) => (
                                <tr key={attempt.id} className={isDark ? '' : ''}>
                                  <td className={`py-2.5 pr-3 text-[12px] font-bold tabular-nums ${isDark ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
                                    #{idx + 1}
                                  </td>
                                  <td className={`py-2.5 pr-3 text-[12px] font-semibold truncate max-w-[140px] ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                                    {attempt.student_name}
                                  </td>
                                  <td className={`py-2.5 pr-3 text-[12px] tabular-nums ${isDark ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                                    {attempt.submitted_at
                                      ? '-'
                                      : attempt.current_question_index != null
                                        ? `Q${attempt.current_question_index + 1}`
                                        : 'Q1'}
                                  </td>
                                  <td className={`py-2.5 pr-3 text-[12px] font-semibold tabular-nums ${isDark ? 'text-accent-green' : 'text-green-600'}`}>
                                    {attempt.submitted_at
                                      ? (attempt.score != null ? attempt.score : '-')
                                      : (attempt.live_score != null ? attempt.live_score : '0')}
                                  </td>
                                  <td className={`py-2.5 pr-3 text-[12px] tabular-nums ${isDark ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                                    {formatDuration(attempt.started_at, attempt.submitted_at, attempt.deadline_at, attempt.auto_submitted)}
                                  </td>
                                  <td className="py-2.5">
                                    <button
                                      type="button"
                                      onClick={() => void handleViewAttempt(attempt)}
                                      className={`h-7 rounded-full px-3 text-[11px] font-semibold transition-spring-fast active:scale-95 ${isDark ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-600 hover:bg-black/10'}`}
                                    >
                                      View Answers
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
          </>
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

function DetailRow({ label, value, theme }: { label: string; value: string; theme: 'light' | 'dark' }) {
  const isDark = theme === 'dark';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[12px] ${isDark ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-[12px] font-semibold tabular-nums ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
