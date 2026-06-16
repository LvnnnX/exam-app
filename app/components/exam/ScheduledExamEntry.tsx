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

function TopicRow({ label, items, dark }: { label: string; items?: string[]; dark?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-[10px] font-medium tracking-tight uppercase ${dark ? 'text-white/40' : 'text-nike-grey-500/80'}`}>
        {label}
      </span>
      <span className={`text-[13px] font-medium tracking-tight truncate ${dark ? 'text-white/90' : 'text-nike-black'}`}>
        {items[0]}
      </span>
      {items.length > 1 && (
        <span
          title={items.join(', ')}
          className={`inline-flex items-center px-1.5 h-5 rounded-full text-[10px] font-medium tabular-nums tracking-tight shrink-0 ${dark ? 'bg-white/10 text-white/50' : 'bg-black/[0.06] text-nike-grey-500'}`}
        >
          +{items.length - 1}
        </span>
      )}
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

  const handleLookup = useCallback(async () => {
    const code = accessCode.trim();
    if (!code) return;
    setView({ kind: 'loading' });
    const result = await lookupScheduledExamAction(code);
    if (result.found) {
      setView({ kind: 'info', exam: result, accessCode: code });
    } else {
      setView({
        kind: 'error',
        message: result.error || 'Kode akses tidak ditemukan.',
      });
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
    <div className="modal-dark-overlay fixed inset-0 z-[100] overflow-hidden bg-dark-800 text-white animate-in fade-in duration-200">
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <motion.div
          layoutId="scheduled-exam-expandable"
          transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
          className="w-full max-w-5xl rounded-[24px] bg-dark-950 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8 lg:p-12"
        >
          {/* ── Loading ── */}
          {view.kind === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
              <p className="mt-3 text-[13px] text-white/65 tracking-tight">
                Mencari ujian…
              </p>
            </div>
          )}

          {/* ── Lookup / Error ── */}
          {isLookupOrError && (
            <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_420px] lg:gap-14">
              <div className="order-1 flex flex-col space-y-5 lg:order-none lg:col-start-1 lg:row-start-1 lg:justify-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Ujian terjadwal
                </p>
                <h2 className="font-display text-[42px] leading-[0.95] tracking-[-0.04em] text-white sm:text-[56px]">
                  Masukkan kode.
                </h2>
                <p className="max-w-md text-[15px] leading-[1.6] tracking-tight text-white/65">
                  Masukkan kode akses dari pengawas ujian untuk masuk ke sesi ujian terjadwal.
                </p>
              </div>

              <div className="order-3 grid gap-3 sm:grid-cols-2 lg:order-none lg:col-start-1 lg:row-start-2">
                <div className="rounded-[10px] bg-white/5 p-4">
                  <p className="text-[12px] font-medium text-white/55">Jadwal ujian</p>
                  <p className="mt-1 text-[13px] text-white/80">Ujian dibuka sesuai jadwal yang ditentukan pengawas.</p>
                </div>
                <div className="rounded-[10px] bg-white/5 p-4">
                  <p className="text-[12px] font-medium text-white/55">Akses kode</p>
                  <p className="mt-1 text-[13px] text-white/80">Kode diverifikasi otomatis sebelum masuk.</p>
                </div>
              </div>

              <div className="order-2 mx-auto w-full max-w-sm rounded-[18px] bg-white p-5 text-nike-black shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:p-6 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:max-w-none lg:self-center">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.12em] text-nike-grey-500">
                  Kode akses *
                </p>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="Masukkan kode"
                  maxLength={20}
                  className={`neumorph-pulse-control h-14 w-full rounded-[8px] px-5 text-[16px] font-semibold tracking-wide transition-spring-fast focus:outline-none ${view.kind === 'error' ? 'bg-red-50 text-nike-red' : 'bg-black/5 text-nike-black focus:bg-black/10'}`}
                />
                {view.kind === 'error' && (
                  <p className="mt-2 text-[12px] font-medium tracking-tight text-nike-red animate-in slide-in-from-top-1">
                    {view.message}
                  </p>
                )}

                <div className="mt-6 space-y-3">
                  <NeumorphButton
                    type="button"
                    intent="primary"
                    size="medium"
                    fullWidth
                    disabled={!accessCode.trim()}
                    onClick={handleLookup}
                    className="h-12"
                  >
                    Cari
                  </NeumorphButton>
                  <NeumorphButton
                    type="button"
                    intent="secondary"
                    size="medium"
                    fullWidth
                    onClick={onClose}
                    className="h-12"
                  >
                    Cancel
                  </NeumorphButton>
                </div>
              </div>
            </div>
          )}

          {/* ── Exam info ── */}
          {isInfo && exam && (
            <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:gap-14">
              <div className="flex flex-col justify-center space-y-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Ujian terjadwal
                </p>
                <h2 className="font-display text-[42px] leading-[0.95] tracking-[-0.04em] text-white sm:text-[56px]">
                  {exam.title || 'Ujian'}
                </h2>
                <div className="space-y-1.5">
                  <TopicRow label="Mapel" items={exam.mapels} dark />
                  <TopicRow label="Bab" items={exam.babs} dark />
                  <TopicRow label="Sub-bab" items={exam.sub_babs} dark />
                </div>
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <div className="rounded-[10px] bg-white/5 p-4">
                    <p className="text-[12px] font-medium text-white/55">Jadwal ujian</p>
                    <p className="mt-1 text-[13px] text-white/80">
                      {formatDateTime(exam.window_start)} — {formatDateTime(exam.window_end)}
                    </p>
                  </div>
                  <div className="rounded-[10px] bg-white/5 p-4">
                    <p className="text-[12px] font-medium text-white/55">Detail</p>
                    <p className="mt-1 text-[13px] text-white/80">
                      {exam.question_count} soal · {formatTimeLimit(exam.time_limit_minutes)} · {exam.mode || '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] bg-white p-5 text-nike-black shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:p-6">
                {/* Window status banners */}
                {isScheduled && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 mb-5">
                    <p className="text-[13px] font-semibold text-amber-400 tracking-tight">
                      Ujian belum dimulai.
                    </p>
                    <p className="text-[12px] text-amber-300/80 tracking-tight mt-0.5">
                      {countdown || formatCountdown(exam.window_start!)}
                    </p>
                  </div>
                )}

                {isUpcoming && !isScheduled && (
                  <div className="rounded-xl bg-black/[0.04] border border-black/[0.06] px-4 py-3 mb-5">
                    <p className="text-[13px] font-semibold text-nike-black tracking-tight">
                      Ujian belum dibuka.
                    </p>
                    <p className="text-[12px] text-nike-grey-500 tracking-tight mt-0.5">
                      {countdown}
                    </p>
                  </div>
                )}

                {isClosed && (
                  <div className="rounded-xl bg-nike-red/10 border border-nike-red/20 px-4 py-3 mb-5">
                    <p className="text-[13px] font-medium text-nike-red tracking-tight">
                      Waktu ujian sudah berakhir.
                    </p>
                  </div>
                )}

                {/* Name input (only when window is open) */}
                {isWindowOpen && (
                  <>
                    <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.12em] text-nike-grey-500">
                      Nama kamu *
                    </p>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value.slice(0, 16))}
                      onKeyDown={(e) => e.key === 'Enter' && canStart && handleStart()}
                      placeholder="Maks. 16 karakter"
                      maxLength={16}
                      autoFocus
                      className="neumorph-pulse-control h-14 w-full rounded-[8px] px-5 text-[16px] font-semibold tracking-wide bg-black/5 text-nike-black focus:bg-black/10 focus:outline-none transition-spring-fast"
                    />
                  </>
                )}

                {/* Actions */}
                <div className="mt-6 space-y-3">
                  {isWindowOpen && (
                    <NeumorphButton
                      type="button"
                      intent="primary"
                      size="medium"
                      fullWidth
                      loading={starting}
                      disabled={!canStart || !studentName.trim()}
                      onClick={handleStart}
                      className="h-12"
                    >
                      {starting ? 'Mempersiapkan…' : 'Mulai ujian'}
                    </NeumorphButton>
                  )}
                  <NeumorphButton
                    type="button"
                    intent="secondary"
                    size="medium"
                    fullWidth
                    onClick={() => {
                      setView({ kind: 'lookup' });
                      setStudentName('');
                    }}
                    className="h-12"
                  >
                    Kembali
                  </NeumorphButton>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
