"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type KuisLog, type Player } from '@/lib/quiz';
import { getHorseSkin } from '@/lib/horse-skins';
import HorseAvatar from '@/app/components/HorseAvatar';
import CrownIcon from '@/app/components/CrownIcon';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { scrimMotion, sheetMotion } from '@/app/components/ui/motion-presets';

type LeaderboardViewModalProps = {
  open: boolean;
  session: KuisLog | null;
  players: Player[];
  onClose: () => void;
  currentTime?: number;
  serverTimeOffset?: number;
  theme?: 'light' | 'dark';
};

// Confetti uses the palette: Pine 300/500, Amber 300/400, Ink 300.
const CONFETTI_COLORS = ['#7fbca9', '#36806c', '#e9b567', '#df9a3f', '#aebbbc'];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function LeaderboardViewModal({ open, session, players, onClose, currentTime, serverTimeOffset = 0, theme = 'dark' }: LeaderboardViewModalProps) {
  const rankBadgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const crownRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const horseScaleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const horseGallopRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousRanksRef = useRef<Map<string, number>>(new Map());
  const previousScoresRef = useRef<Map<string, number>>(new Map());
  const gallopingRef = useRef<Set<string>>(new Set());
  const previousFinishedRef = useRef<Map<string, boolean>>(new Map());
  const [internalNow, setInternalNow] = useState(() => Date.now());

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

  const isStandard = session?.quiz_mode === 'standard';

  // Map players to hide score if in standard mode and not finished
  const mappedPlayers = useMemo(() => {
    return players.map(p => {
      const isFinished = isStandard ? !!p.finished_at : (!!p.finished_at || p.score >= questionCount);
      return {
        ...p,
        score: (isStandard && !isFinished) ? 0 : p.score
      };
    });
  }, [players, isStandard, questionCount]);

  // Fixed display order: sort by joined_at so rows never move
  const fixedOrderPlayers = useMemo(() => {
    return [...mappedPlayers].sort((a, b) => {
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
  }, [mappedPlayers]);

  // Compute ranks based on score (separate from display order)
  const playerRanks = useMemo(() => {
    const sorted = [...mappedPlayers].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.total_time !== b.total_time) return a.total_time - b.total_time;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
    const ranks = new Map<string, number>();
    sorted.forEach((p, i) => ranks.set(p.id, i + 1));
    return ranks;
  }, [mappedPlayers]);

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

  // Nudge the rank token and crown when a rank changes
  useLayoutEffect(() => {
    if (!open) {
      previousRanksRef.current = new Map();
      return;
    }

    const prevRanks = previousRanksRef.current;
    const reduceMotion = prefersReducedMotion();

    fixedOrderPlayers.forEach((player) => {
      const currentRank = playerRanks.get(player.id) ?? 999;
      const previousRank = prevRanks.get(player.id);

      // Only animate if rank actually changed (and we had a previous rank)
      if (!reduceMotion && previousRank !== undefined && previousRank !== currentRank) {
        const badge = rankBadgeRefs.current[player.id];
        const crown = crownRefs.current[player.id];

        // Rank went UP (lower number = better)
        const wentUp = currentRank < previousRank;

        if (badge) {
          badge.animate(
            wentUp
              ? [
                { transform: 'translateY(0) scale(1)' },
                { transform: 'translateY(-3px) scale(1.08)' },
                { transform: 'translateY(0) scale(1)' },
              ]
              : [
                { transform: 'translateY(0) scale(1)' },
                { transform: 'translateY(2px) scale(0.95)' },
                { transform: 'translateY(0) scale(1)' },
              ],
            { duration: 400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          );
        }

        if (crown && currentRank <= 3) {
          crown.animate(
            [
              { transform: 'translateY(0) scale(1)', opacity: '0.6' },
              { transform: 'translateY(-4px) scale(1.1)', opacity: '1' },
              { transform: 'translateY(0) scale(1)', opacity: '1' },
            ],
            { duration: 400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          );
        }
      }
    });

    // Store current ranks for next comparison
    previousRanksRef.current = new Map(playerRanks);
  }, [open, playerRanks, fixedOrderPlayers]);

  // Stable fingerprint of all player scores, changes whenever any score updates
  const scoreFingerprint = useMemo(() => {
    return fixedOrderPlayers.map(p => `${p.id}:${p.score}`).join(',');
  }, [fixedOrderPlayers]);

  // On score increase: small lift, short gallop with one dust puff, settle
  useEffect(() => {
    if (!open) {
      previousScoresRef.current = new Map();
      gallopingRef.current = new Set();
      previousFinishedRef.current = new Map();
      return;
    }

    const prevScores = previousScoresRef.current;
    const prevFinished = previousFinishedRef.current;
    const reduceMotion = prefersReducedMotion();

    fixedOrderPlayers.forEach((player) => {
      const prevScore = prevScores.get(player.id);
      const currentScore = player.score;
      const isFinished = isStandard ? !!player.finished_at : (!!player.finished_at || player.score >= questionCount);
      const wasFinished = prevFinished.get(player.id) === true;

      // Confetti: trigger when a player JUST finished
      if (isFinished && !wasFinished && prevFinished.has(player.id)) {
        // Wait for the mount to reach the finish line position if it moved
        setTimeout(() => {
          const horseEl = horseScaleRefs.current[player.id];
          if (horseEl) {
            const rect = horseEl.getBoundingClientRect();
            const x = (rect.left + rect.width / 2) / window.innerWidth;
            const y = (rect.top + rect.height / 2) / window.innerHeight;

            confetti({
              particleCount: 60,
              spread: 60,
              startVelocity: 28,
              ticks: 140,
              scalar: 0.9,
              origin: { x, y },
              colors: CONFETTI_COLORS,
              zIndex: 10001,
              disableForReducedMotion: true,
            });
          }
        }, 350);
      }

      // Only animate if score went UP and we had a previous score
      if (!reduceMotion && prevScore !== undefined && currentScore > prevScore) {
        const scaleEl = horseScaleRefs.current[player.id];
        const gallopEl = horseGallopRefs.current[player.id];
        if (!scaleEl || !gallopEl || gallopingRef.current.has(player.id)) return;

        gallopingRef.current.add(player.id);

        // Phase 1: lift slightly on the scale wrapper
        const lift = scaleEl.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.12)' },
          ],
          { duration: 200, fill: 'forwards', easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );

        lift.onfinish = () => {
          // Phase 2: short gallop on the inner element, with one dust puff behind
          gallopEl.classList.add('horse-dust');
          const gallopAnim = gallopEl.animate(
            [
              { transform: 'translateY(0) rotate(0deg)', offset: 0 },
              { transform: 'translateY(-3px) rotate(-1.5deg)', offset: 0.3 },
              { transform: 'translateY(1px) rotate(0.75deg)', offset: 0.65 },
              { transform: 'translateY(0) rotate(0deg)', offset: 1 },
            ],
            { duration: 280, iterations: 2, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          );

          // Phase 3: settle back to rest
          gallopAnim.onfinish = () => {
            gallopEl.classList.remove('horse-dust');
            lift.cancel();
            scaleEl.style.transform = 'scale(1.12)';

            const settle = scaleEl.animate(
              [
                { transform: 'scale(1.12)' },
                { transform: 'scale(1)' },
              ],
              { duration: 240, fill: 'forwards', easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
            );

            settle.onfinish = () => {
              scaleEl.style.transform = '';
              settle.cancel();
              gallopingRef.current.delete(player.id);
            };
          };
        };
      }
    });

    // Store current scores and finish states
    const newScores = new Map<string, number>();
    const newFinished = new Map<string, boolean>();
    fixedOrderPlayers.forEach((p) => {
      newScores.set(p.id, p.score);
      newFinished.set(p.id, isStandard ? !!p.finished_at : (!!p.finished_at || p.score >= questionCount));
    });
    previousScoresRef.current = newScores;
    previousFinishedRef.current = newFinished;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scoreFingerprint]);

  const isPaused = session?.status === 'paused';
  const isLowTime = !isPaused && timeRemaining < 60000;

  return (
    <AnimatePresence>
      {open && session && (
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
        aria-labelledby="race-view-title"
        className="glass-sheet flex max-h-[96vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-4xl text-fg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 id="race-view-title" className="text-[18px] font-bold tracking-tight text-fg sm:text-[20px]">Leaderboard</h2>
            <p className="text-[13px] font-medium text-fg-muted">
              {fixedOrderPlayers.length} peserta · {session.question_count} soal
            </p>
          </div>

          <div className="flex items-center gap-2">
            {session.status !== 'waiting' && session.status !== 'finished' && (
              <div
                className={`flex h-11 items-center gap-2.5 rounded-xl px-3.5 ${
                  isPaused ? 'bg-warn/15 text-highlight-fg' : isLowTime ? 'bg-danger/12 text-danger' : 'well text-fg'
                }`}
                aria-label={`${isPaused ? 'Dijeda' : 'Sisa waktu'} ${timeStr}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isPaused ? 'bg-warn' : isLowTime ? 'bg-danger animate-pulse' : 'bg-primary'}`}
                  aria-hidden="true"
                />
                <span className="text-[16px] font-bold leading-none tabular-nums">{timeStr}</span>
                <span className="text-[12px] font-medium opacity-80">
                  {isPaused ? 'Dijeda' : 'Sisa waktu'}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
              aria-label="Tutup"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Lanes */}
        <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-4">
          {fixedOrderPlayers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-[15px] font-semibold text-fg">Belum ada peserta.</p>
              <p className="mt-1 text-[13px] text-fg-muted">Peserta muncul di lintasan setelah bergabung.</p>
            </div>
          ) : (
            <div role="table" aria-label="Posisi peserta di lintasan">
              <div role="row" className="mb-1 flex items-center gap-2 px-1 text-[12px] font-semibold text-fg-muted sm:gap-3">
                <span role="columnheader" className="w-10 shrink-0 text-center">Rank</span>
                <span role="columnheader" className="flex flex-1 items-center justify-between pr-2">
                  <span>Lintasan</span>
                  <span>Finish</span>
                </span>
                <span role="columnheader" className="hidden w-20 shrink-0 text-center sm:block">Status</span>
              </div>

              <div className="space-y-1.5">
                {fixedOrderPlayers.map((player) => {
                  const rank = playerRanks.get(player.id) ?? 999;
                  const progress = Math.max(0, Math.min(100, (player.score / questionCount) * 100));
                  const skin = getHorseSkin(player.horse_skin, player.id);
                  const isFinished = !!player.finished_at || player.score >= questionCount;
                  const isTop3 = rank <= 3;

                  return (
                    <div key={player.id} role="row" className="flex items-center gap-2 px-1 sm:gap-3">
                      {/* Rank token */}
                      <div role="cell" className="w-10 shrink-0">
                        <div
                          ref={(el) => { rankBadgeRefs.current[player.id] = el; }}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-[14px] font-bold tabular-nums ${rank === 1 ? 'clay-highlight' : 'clay'}`}
                        >
                          {rank}
                        </div>
                      </div>

                      {/* Lane */}
                      <div role="cell" className="min-w-0 flex-1">
                        <div className="well relative h-16 w-full overflow-visible rounded-2xl">
                          {/* Progress fill */}
                          <div
                            className="absolute inset-y-0 left-0 z-0 rounded-2xl bg-primary/15 transition-[width] duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                          />

                          {/* Name and score */}
                          <div
                            className={`pointer-events-none absolute inset-y-0 z-10 flex items-center transition-all duration-300 ease-out ${progress > 30 ? 'left-3' : 'left-1/2 -translate-x-1/2'}`}
                          >
                            <span className="max-w-[40vw] truncate text-[13px] font-semibold text-fg-muted sm:max-w-[260px] sm:text-[14px]">
                              {player.name}
                              <span className="mx-1.5 text-fg-subtle" aria-hidden="true">·</span>
                              <span className="tabular-nums text-fg">{player.score}</span>
                            </span>
                          </div>

                          {/* Mount + crown */}
                          <div
                            className="absolute top-1/2 z-20 flex -translate-y-1/2 items-center transition-[left] duration-300 ease-out"
                            style={{ left: `clamp(4px, calc(${progress}% - 30px), calc(100% - 64px))` }}
                          >
                            <div className="relative flex flex-col items-center justify-center">
                              {isTop3 && (
                                <span
                                  ref={(el) => { crownRefs.current[player.id] = el; }}
                                  className="absolute right-[-22px] top-1/2 z-30 -translate-y-1/2 text-[18px]"
                                >
                                  <CrownIcon rank={rank as 1 | 2 | 3} />
                                </span>
                              )}
                              {/* Two nested wrappers: outer for lift, inner for gallop */}
                              <div
                                ref={(el) => { horseScaleRefs.current[player.id] = el; }}
                                className="relative flex items-center justify-center"
                              >
                                <span className="absolute bottom-1 left-1/2 h-1.5 w-9 -translate-x-1/2 rounded-full bg-black/15 blur-[1.5px]" aria-hidden="true" />
                                <div
                                  ref={(el) => { horseGallopRefs.current[player.id] = el; }}
                                  className="relative"
                                >
                                  <HorseAvatar colors={skin.horse} mount={skin.mount} size="lg" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Finish line */}
                          <div className="absolute inset-y-2 right-2 z-10 border-r-2 border-dashed border-line-strong" aria-hidden="true" />
                          {isFinished && (
                            <span className="absolute right-3.5 top-1.5 z-10 text-primary sm:hidden" aria-label="Selesai">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div role="cell" className="hidden w-20 shrink-0 justify-center sm:flex">
                        {isFinished ? (
                          <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary/12 px-2.5 text-[12px] font-semibold text-primary">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                            Selesai
                          </span>
                        ) : (
                          <span className="well inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-fg-muted">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                            Live
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
