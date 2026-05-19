"use client";

import { useCallback } from 'react';

export default function useQuizRankBadgeClasses() {
  const getRankBadgeClasses = useCallback((rank: number, isCurrentPlayer: boolean) => {
    if (rank === 1) {
      return isCurrentPlayer
        ? 'border-white/30 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
        : 'border-amber-300 bg-amber-50 text-amber-800 shadow-[0_0_0_1px_rgba(245,158,11,0.10)]';
    }

    if (rank === 2) {
      return isCurrentPlayer
        ? 'border-white/30 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
        : 'border-slate-300 bg-slate-50 text-slate-700 shadow-[0_0_0_1px_rgba(148,163,184,0.12)]';
    }

    return isCurrentPlayer
      ? 'border-white/30 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
      : 'border-orange-300 bg-orange-50 text-orange-800 shadow-[0_0_0_1px_rgba(251,146,60,0.10)]';
  }, []);

  return {
    getRankBadgeClasses,
  };
}
