'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import NeumorphButton from '@/app/components/ui/neumorph-button';
import {
  lookupScheduledExamAction,
  startScheduledExamAction,
  type ScheduledExamLookup,
} from '@/app/actions/scheduled-exam';

type Props = {
  isOpen: boolean;
  onExamStarted: (
    sessionId: string,
    questionCount: number,
    expiresAt: string,
    navMode: string,
    scheduledExamTitle: string,
    scheduledMapels: string[],
    scheduledBabs: string[],
    scheduledSubBabs: string[],
    scheduledTimeLimitMinutes: number,
    studentName: string,
  ) => void;
  onClose: () => void;
};

type ViewState =
  | { kind: 'lookup' }
  | { kind: 'loading' }
  | { kind: 'info'; exam: ScheduledExamLookup; accessCode: string }
  | { kind: 'error'; message: string };

function formatCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return 'Segera dibuka';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `Dibuka dalam ${hours} jam ${minutes} menit`;
  return `Dibuka dalam ${minutes} menit`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Makassar',
  });
}

function formatTimeLimit(minutes?: number): string {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

function TopicRow({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-14 shrink-0 text-[12px] font-medium text-fg-muted">{label}</span>
      <span className="truncate text-[14px] font-semibold text-fg">{items[0]}</span>
      {items.length > 1 && (
        <span
          title={items.join(', ')}
          className="well inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums text-fg-muted"
        >
          +{items.length - 1}
        </span>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[13px] text-fg-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold tabular-nums text-fg">{value}</span>
    </div>
  );
}

export default function ScheduledExamEntry({
  isOpen,
  onExamStarted,
  onClose,
}: Props) {
  const [view, setView] = useState<ViewState>({ kind: 'lookup' });
  const [accessCode, setAccessCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [countdown, setCountdown] = useState('');
  const [starting, setStarting] = useState(false);

  // Live countdown for upcoming windows
  useEffect(() => {
    if (view.kind !== 'info' || view.exam.window_status !== 'upcoming' || !view.exam.window_start) return;
    const tick = () => setCountdown(formatCountdown(view.exam.window_start!));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [view]);

  // Escape closes the dialog, except while the exam session is being started.
  useEffect(() => {
    if (!isOpen || starting) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, starting, onClose]);

  const handleLookup = useCallback(async () => {
    const code = accessCode.trim();
    if (!code) return;
    setView({ kind: 'loading' });
    try {
      const result = await lookupScheduledExamAction(code);
      if (result.found) {
        setView({ kind: 'info', exam: result, accessCode: code });
      } else {
        setView({
          kind: 'error',
          message: result.error || 'Kode akses tidak ditemukan.',
        });
      }
    } catch {
      // Without this the dialog would stay on the loading state forever.
      setView({ kind: 'error', message: 'Gagal mencari ujian. Periksa koneksi, lalu coba lagi.' });
    }
  }, [accessCode]);

  const handleStart = useCallback(async () => {
    if (!studentName.trim() || starting) return;
    setStarting(true);
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const result = await startScheduledExamAction(
        studentName.trim(),
        (view as { kind: 'info'; accessCode: string }).accessCode,
        ua,
      );
      if (result.success && result.session_id && result.question_count && result.expires_at) {
        onExamStarted(
          result.session_id,
          result.question_count,
          result.expires_at,
          result.nav_mode || 'strict',
          result.scheduled_exam_title || (view as { kind: 'info'; exam: ScheduledExamLookup }).exam.title || 'Ujian',
          result.scheduled_mapels || (view as { kind: 'info'; exam: ScheduledExamLookup }).exam.mapels || [],
          result.scheduled_babs || (view as { kind: 'info'; exam: ScheduledExamLookup }).exam.babs || [],
          result.scheduled_sub_babs || (view as { kind: 'info'; exam: ScheduledExamLookup }).exam.sub_babs || [],
          result.scheduled_time_limit_minutes || (view as { kind: 'info'; exam: ScheduledExamLookup }).exam.time_limit_minutes || 0,
          studentName.trim(),
        );
      } else {
        setView({
          kind: 'error',
          message: result.error || 'Gagal memulai ujian.',
        });
      }
    } finally {
      setStarting(false);
    }
  }, [studentName, starting, view, onExamStarted]);

  if (!isOpen) return null;

  // ── Lookup / Error state ──
  const isLookupOrError = view.kind === 'lookup' || view.kind === 'error';

  // ── Info state helpers ──
  const isInfo = view.kind === 'info';
  const exam = isInfo ? view.exam : null;
  const isUpcoming = exam?.window_status === 'upcoming';
  const isClosed = exam?.window_status === 'closed';
  const isWindowOpen = exam?.window_status === 'open';
  const isScheduled = exam?.status === 'scheduled';
  const isExpired = exam?.status === 'expired';
  const canStart = isWindowOpen && !starting;

  return (
    <div
      className="glass-scrim fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      onClick={() => { if (!starting) onClose(); }}
    >
      {/* Grows out of the "Ujian terjadwal" button on the setup screen (shared layoutId). */}
      <motion.div
        layoutId="scheduled-exam-expandable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduled-entry-title"
        className={`glass-sheet my-auto w-full overflow-hidden rounded-4xl ${isInfo ? 'max-w-lg' : 'max-w-sm'}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* ── Loading ── */}
        {view.kind === 'loading' && (
          <div className="flex flex-col items-center justify-center px-6 py-16" role="status">
            <span className="spinner-calm h-6 w-6" aria-hidden="true" />
            <p id="scheduled-entry-title" className="mt-3 text-[14px] font-medium text-fg-muted">
              Mencari ujian…
            </p>
          </div>
        )}

        {/* ── Lookup / Error ── */}
        {isLookupOrError && (
          <>
            <div className="px-6 pt-7 pb-5 text-center">
              <p className="mb-1.5 text-[12px] font-medium text-fg-muted">Ujian terjadwal</p>
              <h2 id="scheduled-entry-title" className="mb-1.5 text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-fg">
                Masukkan kode.
              </h2>
              <p className="mb-6 text-[13px] text-fg-muted">Kode akses dari pengawas ujian.</p>

              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="Masukkan kode"
                maxLength={20}
                aria-label="Kode akses ujian"
                aria-invalid={view.kind === 'error'}
                autoFocus
                className={`h-14 w-full rounded-xl px-5 text-center font-mono text-[18px] font-semibold tracking-[0.12em] transition-calm placeholder:font-sans placeholder:tracking-normal placeholder:text-fg-subtle/70 ${view.kind === 'error' ? 'bg-danger/10 text-danger' : 'well text-fg'}`}
              />
              {view.kind === 'error' && (
                <p className="mt-2 text-[13px] font-medium text-danger" role="alert">
                  {view.message}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-line px-6 py-4">
              <NeumorphButton type="button" intent="secondary" size="medium" fullWidth onClick={onClose} className="flex-1">
                Cancel
              </NeumorphButton>
              <NeumorphButton
                type="button"
                intent="primary"
                size="medium"
                fullWidth
                disabled={!accessCode.trim()}
                onClick={handleLookup}
                className="flex-1"
              >
                Cari
              </NeumorphButton>
            </div>
          </>
        )}

        {/* ── Exam info ── */}
        {isInfo && exam && (
          <>
            <div className="space-y-4 px-6 pt-6 pb-5">
              <div>
                <p className="text-[12px] font-medium text-fg-muted">Ujian terjadwal</p>
                <h2 id="scheduled-entry-title" className="mt-0.5 text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-fg">
                  {exam.title || 'Ujian'}
                </h2>
              </div>

              <div className="well space-y-1.5 rounded-2xl px-4 py-3">
                <TopicRow label="Mapel" items={exam.mapels} />
                <TopicRow label="Bab" items={exam.babs} />
                <TopicRow label="Sub-bab" items={exam.sub_babs} />
              </div>

              <div className="space-y-2">
                <InfoRow label="Dibuka" value={formatDateTime(exam.window_start)} />
                <InfoRow label="Ditutup" value={formatDateTime(exam.window_end)} />
                <InfoRow label="Soal" value={`${exam.question_count} soal`} />
                <InfoRow label="Batas waktu" value={formatTimeLimit(exam.time_limit_minutes)} />
              </div>

              {/* Window status notices */}
              {isScheduled && (
                <div className="well rounded-2xl px-4 py-3" role="status">
                  <p className="text-[14px] font-semibold text-fg">Ujian belum dimulai.</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-fg-muted">
                    {countdown || formatCountdown(exam.window_start!)}
                  </p>
                </div>
              )}

              {isUpcoming && !isScheduled && (
                <div className="well rounded-2xl px-4 py-3" role="status">
                  <p className="text-[14px] font-semibold text-fg">Ujian belum dibuka.</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-fg-muted">{countdown}</p>
                </div>
              )}

              {(isClosed || isExpired) && (
                <div className="rounded-2xl bg-danger/10 px-4 py-3" role="status">
                  <p className="text-[14px] font-semibold text-danger">Waktu ujian sudah berakhir.</p>
                </div>
              )}

              {/* Name input (only when window is open) */}
              {isWindowOpen && (
                <div>
                  <label htmlFor="scheduled-student-name" className="mb-2 block text-[13px] font-medium text-fg-muted">
                    Nama kamu
                  </label>
                  <input
                    id="scheduled-student-name"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value.slice(0, 16))}
                    onKeyDown={(e) => e.key === 'Enter' && canStart && handleStart()}
                    placeholder="Maks. 16 karakter"
                    maxLength={16}
                    autoFocus
                    className="well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
                  />
                  <p className="mt-1.5 text-right text-[12px] tabular-nums text-fg-subtle">{studentName.length}/16</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-line px-6 py-4">
              <NeumorphButton
                type="button"
                intent="secondary"
                size="medium"
                fullWidth
                disabled={starting}
                onClick={() => {
                  setView({ kind: 'lookup' });
                  setStudentName('');
                }}
                className="flex-1"
              >
                Kembali
              </NeumorphButton>
              {isWindowOpen && (
                <NeumorphButton
                  type="button"
                  intent="primary"
                  size="medium"
                  fullWidth
                  loading={starting}
                  disabled={!canStart || !studentName.trim()}
                  onClick={handleStart}
                  className="flex-1"
                >
                  {starting ? 'Mempersiapkan…' : 'Mulai ujian'}
                </NeumorphButton>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
