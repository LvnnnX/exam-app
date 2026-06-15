'use client';

import React, { useState, useEffect, useCallback } from 'react';
import NeumorphButton from '@/app/components/ui/neumorph-button';
import {
  lookupScheduledExamAction,
  startScheduledExamAction,
  type ScheduledExamLookup,
} from '@/app/actions/scheduled-exam';

type Props = {
  onExamStarted: (
    sessionId: string,
    questionCount: number,
    expiresAt: string,
  ) => void;
  theme: 'light' | 'dark';
  onClose?: () => void;
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
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase">
        {label}
      </span>
      <span className="text-[13px] font-medium text-nike-black tracking-tight truncate">
        {items[0]}
      </span>
      {items.length > 1 && (
        <span
          title={items.join(', ')}
          className="inline-flex items-center px-1.5 h-5 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums tracking-tight shrink-0"
        >
          +{items.length - 1}
        </span>
      )}
    </div>
  );
}

export default function ScheduledExamEntry({
  onExamStarted,
  theme: _theme,
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
        onExamStarted(result.session_id, result.question_count, result.expires_at);
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

  // ── Lookup state ──
  if (view.kind === 'lookup' || view.kind === 'error') {
    return (
      <div className="flex-1 flex flex-col pt-10 md:pt-16 px-5 sm:px-6 pb-10">
        <div className="max-w-2xl mx-auto w-full">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mb-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/5 text-nike-black text-[12px] font-medium hover:bg-black/10 transition-spring-fast active:scale-95 tracking-tight"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Kembali
            </button>
          )}
          <div className="mb-7 md:mb-10">
            <h2 className="font-display text-[36px] sm:text-[48px] text-nike-black leading-[1.05] tracking-[-0.02em] mb-2">
              Ujian terjadwal.
            </h2>
            <p className="text-[14px] text-nike-grey-500 tracking-tight">
              Masukkan kode akses dari pengawas ujian.
            </p>
          </div>

          {view.kind === 'error' && (
            <div className="max-w-md w-full mb-5 rounded-2xl bg-nike-red/10 border border-nike-red/20 px-4 py-3">
              <p className="text-[13px] font-medium text-nike-red tracking-tight">
                {view.message}
              </p>
            </div>
          )}

          <div className="max-w-md w-full flex flex-col gap-3">
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="Kode akses"
              maxLength={20}
              autoFocus
              className="neumorph-pulse-control w-full h-11 rounded-2xl bg-black/5 px-4 text-[14px] font-medium text-nike-black placeholder-nike-grey-500/70 focus:outline-none focus:bg-black/10 transition-spring-fast"
            />
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
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (view.kind === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-nike-grey-500 border-t-transparent" />
        <p className="mt-3 text-[13px] text-nike-grey-500 tracking-tight">
          Mencari ujian…
        </p>
      </div>
    );
  }

  // ── Exam info state ──
  const { exam } = view;
  const isUpcoming = exam.window_status === 'upcoming';
  const isClosed = exam.window_status === 'closed';
  const isOpen = exam.window_status === 'open';
  const canStart = isOpen && !starting;

  return (
    <div className="flex-1 flex flex-col pt-10 md:pt-16 px-5 sm:px-6 pb-10">
      <div className="max-w-2xl mx-auto w-full">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mb-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/5 text-nike-black text-[12px] font-medium hover:bg-black/10 transition-spring-fast active:scale-95 tracking-tight"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Kembali
          </button>
        )}
        <div className="mb-7 md:mb-10">
          <p className="text-[12px] font-medium text-nike-grey-500 mb-2 tracking-tight">
            Ujian terjadwal
          </p>
          <h2 className="font-display text-[36px] sm:text-[48px] text-nike-black leading-[1.05] tracking-[-0.02em] mb-2">
            {exam.title || 'Ujian'}
          </h2>
        </div>

        <div className="max-w-md w-full">
          {/* Exam details card */}
          <div className="rounded-3xl bg-black/[0.03] p-5 mb-6 space-y-5">
            <div className="space-y-2">
              <TopicRow label="Mapel" items={exam.mapels} />
              <TopicRow label="Bab" items={exam.babs} />
              <TopicRow label="Sub-bab" items={exam.sub_babs} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">
                  Mode
                </p>
                <p className="text-[14px] font-semibold text-nike-black tracking-tight capitalize">
                  {exam.mode || '-'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">
                  Jumlah soal
                </p>
                <p className="text-[14px] font-semibold text-nike-black tabular-nums tracking-tight">
                  {exam.question_count ?? '-'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">
                  Batas waktu
                </p>
                <p className="text-[14px] font-semibold text-nike-black tabular-nums tracking-tight">
                  {formatTimeLimit(exam.time_limit_minutes)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">
                  Percobaan
                </p>
                <p className="text-[14px] font-semibold text-nike-black tracking-tight capitalize">
                  {exam.attempt_mode || '-'}
                </p>
              </div>
            </div>

            {/* Window info */}
            <div className="pt-3 border-t border-black/[0.06]">
              <p className="text-[11px] font-medium text-nike-grey-500 mb-1 tracking-tight">
                Jadwal ujian
              </p>
              <p className="text-[12px] text-nike-grey-500 tracking-tight">
                {formatDateTime(exam.window_start)} — {formatDateTime(exam.window_end)}
              </p>
            </div>
          </div>

          {/* Window status banners */}
          {isUpcoming && (
            <div className="rounded-2xl bg-black/[0.04] border border-black/[0.06] px-4 py-3 mb-5">
              <p className="text-[13px] font-semibold text-nike-black tracking-tight">
                Ujian belum dibuka.
              </p>
              <p className="text-[12px] text-nike-grey-500 tracking-tight mt-0.5">
                {countdown}
              </p>
            </div>
          )}

          {isClosed && (
            <div className="rounded-2xl bg-nike-red/10 border border-nike-red/20 px-4 py-3 mb-5">
              <p className="text-[13px] font-medium text-nike-red tracking-tight">
                Waktu ujian sudah berakhir.
              </p>
            </div>
          )}

          {/* Name input + start (only when window is open) */}
          {isOpen && (
            <div className="flex flex-col gap-3 mb-5">
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value.slice(0, 16))}
                onKeyDown={(e) => e.key === 'Enter' && canStart && handleStart()}
                placeholder="Nama kamu (maks. 16 karakter)"
                maxLength={16}
                autoFocus
                className="neumorph-pulse-control w-full h-11 rounded-2xl bg-black/5 px-4 text-[14px] font-medium text-nike-black placeholder-nike-grey-500/70 focus:outline-none focus:bg-black/10 transition-spring-fast"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <NeumorphButton
              type="button"
              intent="secondary"
              size="medium"
              fullWidth
              onClick={() => {
                setView({ kind: 'lookup' });
                setStudentName('');
              }}
              className="h-12 sm:flex-1"
            >
              Kembali
            </NeumorphButton>
            {isOpen && (
              <NeumorphButton
                type="button"
                intent="primary"
                size="medium"
                fullWidth
                loading={starting}
                disabled={!canStart || !studentName.trim()}
                onClick={handleStart}
                className="h-12 sm:flex-1"
              >
                {starting ? 'Mempersiapkan…' : 'Mulai ujian'}
              </NeumorphButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
