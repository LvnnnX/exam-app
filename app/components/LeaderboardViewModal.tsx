"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatHMS, type KuisLog, type Player } from '@/lib/quiz';

type LeaderboardViewModalProps = {
  open: boolean;
  session: KuisLog | null;
  players: Player[];
  onClose: () => void;
  currentTime?: number;
  serverTimeOffset?: number;
};

type HorseTheme = {
  bar: string;
  ring: string;
};

const HORSE_THEMES: HorseTheme[] = [
  { bar: 'from-amber-400 to-orange-500', ring: 'ring-amber-300' },
  { bar: 'from-slate-500 to-slate-700', ring: 'ring-slate-300' },
  { bar: 'from-emerald-400 to-lime-500', ring: 'ring-emerald-300' },
  { bar: 'from-fuchsia-400 to-rose-500', ring: 'ring-fuchsia-300' },
  { bar: 'from-sky-400 to-blue-500', ring: 'ring-sky-300' },
  { bar: 'from-orange-400 to-red-500', ring: 'ring-orange-300' },
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export default function LeaderboardViewModal({ open, session, players, onClose, currentTime, serverTimeOffset = 0 }: LeaderboardViewModalProps) {
  const rankBadgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const crownRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const previousRanksRef = useRef<Map<string, number>>(new Map());
  const [internalNow, setInternalNow] = useState(Date.now());

  // Use currentTime if provided (from parent), otherwise fallback to internalNow
  const effectiveNow = currentTime !== undefined ? currentTime : internalNow;

  useEffect(() => {
    if (!open || !session || session.status === 'finished' || currentTime !== undefined) return;
    const interval = setInterval(() => setInternalNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open, session, currentTime]);

  const questionCount = Math.max(1, session?.question_count || 1);

  const timeRemaining = useMemo(() => {
    if (!session || session.status === 'finished' || !session.expires_at) return 0;
    
    const expiresAt = new Date(session.expires_at).getTime();
    const syncedNow = (session.status === 'paused' && session.paused_at)
      ? new Date(session.paused_at).getTime()
      : effectiveNow + serverTimeOffset;

    return Math.max(0, expiresAt - syncedNow);
  }, [session, effectiveNow, serverTimeOffset]);

  const timeStr = useMemo(() => {
    const totalSeconds = Math.ceil(timeRemaining / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  // Fixed display order: sort by joined_at so rows never move
  const fixedOrderPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
  }, [players]);

  // Compute ranks based on score (separate from display order)
  const playerRanks = useMemo(() => {
    const sorted = [...players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.total_time !== b.total_time) return a.total_time - b.total_time;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
    const ranks = new Map<string, number>();
    sorted.forEach((p, i) => ranks.set(p.id, i + 1));
    return ranks;
  }, [players]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  // Animate rank badge & crown when rank changes
  useLayoutEffect(() => {
    if (!open) {
      previousRanksRef.current = new Map();
      return;
    }

    const prevRanks = previousRanksRef.current;

    fixedOrderPlayers.forEach((player) => {
      const currentRank = playerRanks.get(player.id) ?? 999;
      const previousRank = prevRanks.get(player.id);

      // Only animate if rank actually changed (and we had a previous rank)
      if (previousRank !== undefined && previousRank !== currentRank) {
        const badge = rankBadgeRefs.current[player.id];
        const crown = crownRefs.current[player.id];

        // Rank went UP (lower number = better)
        const wentUp = currentRank < previousRank;

        if (badge) {
          badge.animate(
            wentUp
              ? [
                { transform: 'scale(1)', filter: 'brightness(1)' },
                { transform: 'scale(1.35) translateY(-6px)', filter: 'brightness(1.2)' },
                { transform: 'scale(1)', filter: 'brightness(1)' },
              ]
              : [
                { transform: 'scale(1)', filter: 'brightness(1)' },
                { transform: 'scale(0.8) translateY(4px)', filter: 'brightness(0.85)' },
                { transform: 'scale(1)', filter: 'brightness(1)' },
              ],
            { duration: 600, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          );
        }

        if (crown && currentRank <= 3) {
          crown.animate(
            [
              { transform: 'translateY(0px) scale(1) rotate(0deg)', opacity: '0.5' },
              { transform: 'translateY(-12px) scale(1.4) rotate(-8deg)', opacity: '1' },
              { transform: 'translateY(0px) scale(1) rotate(0deg)', opacity: '1' },
            ],
            { duration: 700, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          );
        }
      }
    });

    // Store current ranks for next comparison
    previousRanksRef.current = new Map(playerRanks);
  }, [open, playerRanks, fixedOrderPlayers]);

  if (!open || !session) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-xl p-2 sm:p-4" onClick={onClose}>
      <div className="flex max-h-[96vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-b from-white to-slate-50 shadow-[0_30px_80px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-slate-200/80 bg-white px-5 py-4 sm:px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏁</span>
              <div className="text-center">
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 sm:text-xl">Leaderboard</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {fixedOrderPlayers.length} peserta • {session.question_count} soal
                </p>
              </div>
            </div>

            {/* Timer Display */}
            {session.status !== 'waiting' && session.status !== 'finished' && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 transition-all ${
                session.status === 'paused' ? 'bg-orange-50 border-orange-200' : 
                timeRemaining < 60000 ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-xl">⏱️</span>
                <div className="flex flex-col">
                  <span className={`font-mono text-xl font-black tabular-nums leading-none ${
                    session.status === 'paused' ? 'text-orange-600' :
                    timeRemaining < 60000 ? 'text-red-600' : 'text-slate-900'
                  }`}>
                    {timeStr}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                    {session.status === 'paused' ? 'PAUSED' : 'SISA WAKTU'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute right-5 sm:right-8 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {fixedOrderPlayers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-bold text-slate-400">Belum ada peserta</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                <tr className="border-b border-slate-200">
                  <th className="w-14 px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rank</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <div className="flex items-center justify-between pr-2">
                      <span>Lintasan</span>
                      <span className="text-slate-300">🏁 Finish</span>
                    </div>
                  </th>
                  <th className="w-20 px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fixedOrderPlayers.map((player) => {
                  const rank = playerRanks.get(player.id) ?? 999;
                  const progress = Math.max(0, Math.min(100, (player.score / questionCount) * 100));
                  const theme = HORSE_THEMES[hashString(player.id) % HORSE_THEMES.length];
                  const isFinished = !!player.finished_at || player.score >= questionCount;
                  const isTop3 = rank <= 3;

                  const rankBadge = rank === 1
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : rank === 2
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : rank === 3
                        ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-white text-slate-400 border-slate-100';

                  return (
                    <tr key={player.id} className="transition-colors">
                      {/* Rank badge */}
                      <td className="px-2 py-1.5">
                        <div
                          ref={(el) => { rankBadgeRefs.current[player.id] = el; }}
                          className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl border text-[12px] font-black transition-all duration-300 ${rankBadge}`}
                        >
                          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                        </div>
                      </td>

                      {/* Race Track */}
                      <td className="px-2 py-1.5">
                        <div className="relative h-16 w-full overflow-visible rounded-2xl border border-slate-200/60 bg-slate-100/70">
                          {/* Track stripes */}
                          <div className="absolute inset-0 rounded-2xl opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.13) 0, rgba(148,163,184,0.13) 1px, transparent 1px, transparent 60px)' }} />

                          {/* Filled progress */}
                          <div
                            className={`absolute inset-y-0 left-0 rounded-2xl bg-gradient-to-r ${theme.bar} opacity-20 transition-[width] duration-500 ease-out`}
                            style={{ width: `${progress}%` }}
                          />

                          {/* Horse + crown + name + score */}
                          <div
                            className="absolute top-0 bottom-0 flex items-center transition-[left] duration-500 ease-out"
                            style={{ left: `clamp(8px, calc(${progress}% - 18px), calc(100% - 44px))` }}
                          >
                            <div className="relative flex flex-col items-center">
                              {/* Crown for top 3 – animated */}
                              {isTop3 && (
                                <span
                                  ref={(el) => { crownRefs.current[player.id] = el; }}
                                  className="absolute -top-4 left-1/2 -translate-x-1/2 text-[16px] drop-shadow-md transition-all duration-300"
                                >
                                  {rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'}
                                </span>
                              )}
                              {/* Horse */}
                              <span className="text-[24px] leading-none drop-shadow-sm mt-1">🐎</span>
                              {/* Player name */}
                              <span className="absolute top-[32px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black uppercase tracking-wider text-slate-700 max-w-[90px] truncate text-center leading-none">
                                {player.name}
                              </span>
                              {/* Score */}
                              <span className="absolute top-[42px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-slate-400 leading-none">
                                {player.score}/{questionCount}
                              </span>
                            </div>
                          </div>

                          {/* Finish line */}
                          <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-[repeating-linear-gradient(180deg,#1e293b_0,#1e293b_3px,white_3px,white_6px)] rounded-r-2xl opacity-40" />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5 text-center">
                        {isFinished ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black text-green-700">
                            ✓ Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black text-blue-500">
                            ● Live
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 sm:px-8">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {/* <span>Total: {fixedOrderPlayers.length} peserta</span> */}
          </div>
        </div>
      </div>
    </div>
  );
}