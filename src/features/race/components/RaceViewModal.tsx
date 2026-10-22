'use client';

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { LivePlayerProgress, Quiz } from '@/src/features/kuis/types';
import { buildLanes } from '../logic';
import { useRaceEffects } from '../hooks/useRaceEffects';
import RaceLaneRow from './RaceLaneRow';
import RaceRankList from './RaceRankList';

interface RaceViewModalProps {
  open: boolean;
  onClose: () => void;
  quiz: Quiz;
  players: LivePlayerProgress[];
}

export default function RaceViewModal({ open, ...rest }: RaceViewModalProps) {
  if (!open) return null;
  return createPortal(<RaceViewDialog {...rest} />, document.body);
}

function RaceViewDialog({ onClose, quiz, players }: Omit<RaceViewModalProps, 'open'>) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lanes = useMemo(() => buildLanes(quiz, players), [quiz, players]);
  const { registerMount, announcement } = useRaceEffects(lanes);
  const total = lanes[0]?.total ?? quiz.config?.question_count ?? 0;
  const isStandard = quiz.config?.quiz_mode === 'standard' && quiz.status !== 'finished';
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button, summary, [href], [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="glass-scrim fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-sheet animate-in flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-4xl sm:rounded-4xl"
      >
        <header className="flex items-start gap-3 border-b border-line p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[18px] font-semibold text-fg">
              Balapan kuis {quiz.code}
            </h2>
            <p className="text-[13px] text-fg-muted">
              {lanes.length} peserta, {total} soal
            </p>
            {isStandard && (
              <p className="mt-1 text-[13px] text-fg-muted">
                Mode standard: skor peserta yang belum selesai disembunyikan dan posisinya mengikuti jumlah soal dijawab. Setelah selesai, posisi mengikuti skor.
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="well well-hover transition-calm flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-8" data-race-scroll>
          {lanes.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-fg-muted">
              Belum ada peserta. Lajur muncul begitu siswa bergabung dengan kode {quiz.code}.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2" aria-label="Lajur balapan">
                {lanes.map((lane) => (
                  <RaceLaneRow key={lane.id} lane={lane} registerMount={registerMount} />
                ))}
              </ul>
              <RaceRankList lanes={lanes} announcement={announcement} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
