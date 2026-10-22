'use client';

import React, { useCallback, useState } from 'react';
import { Flag } from 'lucide-react';
import type { LivePlayerProgress, Quiz } from '@/src/features/kuis/types';
import RaceViewModal from './RaceViewModal';

interface RaceViewButtonProps {
  quiz: Quiz;
  players: LivePlayerProgress[];
  className?: string;
}

export default function RaceViewButton({ quiz, players, className = '' }: RaceViewButtonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`well well-hover transition-calm inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-medium text-fg ${className}`}
      >
        <Flag size={16} aria-hidden="true" />
        <span>Lihat balapan</span>
      </button>
      <RaceViewModal open={open} onClose={close} quiz={quiz} players={players} />
    </>
  );
}
