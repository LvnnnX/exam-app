"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type KuisLog, type Player } from '@/lib/quiz';
import { getHorseSkin } from '@/lib/horse-skins';
import HorseAvatar from '@/app/components/HorseAvatar';
import CrownIcon from '@/app/components/CrownIcon';
import confetti from 'canvas-confetti';

type LeaderboardViewModalProps = {
  open: boolean;
  session: KuisLog | null;
  players: Player[];
  onClose: () => void;
  currentTime?: number;
  serverTimeOffset?: number;
  theme?: 'light' | 'dark';
};

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

  // Stable fingerprint of all player scores – changes whenever any score updates
  const scoreFingerprint = useMemo(() => {
    return fixedOrderPlayers.map(p => `${p.id}:${p.score}`).join(',');
  }, [fixedOrderPlayers]);

  // Animate horse when score increases: zoom-in → gallop → zoom-out
  useEffect(() => {
    if (!open) {
      previousScoresRef.current = new Map();
      gallopingRef.current = new Set();
      previousFinishedRef.current = new Map();
      return;
    }

    const prevScores = previousScoresRef.current;
    const prevFinished = previousFinishedRef.current;

    fixedOrderPlayers.forEach((player) => {
      const prevScore = prevScores.get(player.id);
      const currentScore = player.score;
      const isFinished = isStandard ? !!player.finished_at : (!!player.finished_at || player.score >= questionCount);
      const wasFinished = prevFinished.get(player.id) === true;

      // Confetti logic: trigger when a player JUST finished
      if (isFinished && !wasFinished && prevFinished.has(player.id)) {
        
        // Wait a tiny bit for the horse to reach the finish line position if it moved
        setTimeout(() => {
          const horseEl = horseScaleRefs.current[player.id];
          if (horseEl) {
            const rect = horseEl.getBoundingClientRect();
            const x = (rect.left + rect.width / 2) / window.innerWidth;
            const y = (rect.top + rect.height / 2) / window.innerHeight;

            confetti({
              particleCount: 100,
              spread: 70,
              origin: { x, y },
              colors: ['#FFD700', '#FFA500', '#FF4500', '#00FF00', '#0000FF'],
              zIndex: 10001,
            });
          }
        }, 500);
      }

      // Only animate if score went UP and we had a previous score
      if (prevScore !== undefined && currentScore > prevScore) {
        const scaleEl = horseScaleRefs.current[player.id];
        const gallopEl = horseGallopRefs.current[player.id];
        if (!scaleEl || !gallopEl || gallopingRef.current.has(player.id)) return;

        gallopingRef.current.add(player.id);

        // Phase 1: Zoom In (300ms) — on the scale wrapper
        const zoomIn = scaleEl.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.4)' },
          ],
          { duration: 300, fill: 'forwards', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
        );

        zoomIn.onfinish = () => {
          // Phase 2: Gallop — Web Animations API on the INNER gallopEl
          // Rapid bounce up/down + slight rotation to simulate running
          const gallopAnim = gallopEl.animate(
            [
              { transform: 'translateY(0px) rotate(0deg)', offset: 0 },
              { transform: 'translateY(-6px) rotate(-3deg)', offset: 0.15 },
              { transform: 'translateY(2px) rotate(1.5deg)', offset: 0.3 },
              { transform: 'translateY(-5px) rotate(-2deg)', offset: 0.45 },
              { transform: 'translateY(2px) rotate(1.5deg)', offset: 0.6 },
              { transform: 'translateY(-6px) rotate(-3deg)', offset: 0.75 },
              { transform: 'translateY(2px) rotate(1deg)', offset: 0.9 },
              { transform: 'translateY(0px) rotate(0deg)', offset: 1 },
            ],
            { duration: 300, iterations: 3, easing: 'linear' }
          );

          // Phase 3: After gallop finishes, zoom out
          gallopAnim.onfinish = () => {
            // Cancel zoomIn fill-forward so it doesn't block zoomOut
            zoomIn.cancel();
            scaleEl.style.transform = 'scale(1.4)';

            const zoomOut = scaleEl.animate(
              [
                { transform: 'scale(1.4)' },
                { transform: 'scale(1)' },
              ],
              { duration: 400, fill: 'forwards', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
            );

            zoomOut.onfinish = () => {
              scaleEl.style.transform = '';
              zoomOut.cancel();
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

  if (!open || !session) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-xl p-2 sm:p-4" onClick={onClose}>
      <div className={`flex max-h-[96vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[32px] shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`relative flex items-center justify-center border-b p-4 ${theme === 'dark' ? 'border-[#2a2a2a] bg-dark-750' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏁</span>
              <div className="text-center">
                <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-slate-900'}`}>Leaderboard</h2>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>
                  {fixedOrderPlayers.length} peserta • {session.question_count} soal
                </p>
              </div>
            </div>

            {/* Timer Display */}
            {session.status !== 'waiting' && session.status !== 'finished' && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${session.status === 'paused' ? (theme === 'dark' ? 'bg-accent-orange/20 border-accent-orange/30' : 'bg-orange-50 border-orange-200') :
                timeRemaining < 60000 ? (theme === 'dark' ? 'bg-accent-red/20 border-accent-red/30 animate-pulse' : 'bg-red-50 border-red-200 animate-pulse') : (theme === 'dark' ? 'bg-dark-700 border-[#2a2a2a]' : 'bg-slate-50 border-slate-200')
                }`}>
                <span className="text-base">⏱️</span>
                <div className="flex flex-col">
                  <span className={`font-mono text-base font-bold tabular-nums leading-none ${session.status === 'paused' ? (theme === 'dark' ? 'text-accent-orange' : 'text-orange-600') :
                    timeRemaining < 60000 ? (theme === 'dark' ? 'text-accent-red' : 'text-red-600') : (theme === 'dark' ? 'text-dark-text-primary' : 'text-slate-900')
                    }`}>
                    {timeStr}
                  </span>
                  <span className={`text-[8px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>
                    {session.status === 'paused' ? 'PAUSED' : 'SISA WAKTU'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className={`absolute right-4 flex h-7 w-7 items-center justify-center rounded-full transition-spring-fast hover:scale-110 ${theme === 'dark' ? 'hover:bg-dark-700 text-dark-text-tertiary' : 'hover:bg-slate-100 text-slate-400'}`}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {fixedOrderPlayers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>Belum ada peserta</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className={`sticky top-0 z-10 backdrop-blur-sm ${theme === 'dark' ? 'bg-dark-750/95' : 'bg-slate-50/95'}`}>
                <tr className={`border-b ${theme === 'dark' ? 'border-[#2a2a2a]' : 'border-slate-200'}`}>
                  <th className={`w-14 px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>Rank</th>
                  <th className={`px-2 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>
                    <div className="flex items-center justify-between pr-2">
                      <span>Lintasan</span>
                      <span className={theme === 'dark' ? 'text-dark-text-tertiary/50' : 'text-slate-300'}>🏁 Finish</span>
                    </div>
                  </th>
                  <th className={`w-20 px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-[#2a2a2a]' : 'divide-slate-100'}`}>
                {fixedOrderPlayers.map((player) => {
                  const rank = playerRanks.get(player.id) ?? 999;
                  const progress = Math.max(0, Math.min(100, (player.score / questionCount) * 100));
                  const skin = getHorseSkin(player.horse_skin, player.id);
                  const isFinished = !!player.finished_at || player.score >= questionCount;
                  const isTop3 = rank <= 3;

                  const rankBadge = rank === 1
                    ? (theme === 'dark' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-200')
                    : rank === 2
                      ? (theme === 'dark' ? 'bg-slate-500/20 text-slate-300 border-slate-500/30' : 'bg-slate-100 text-slate-600 border-slate-200')
                      : rank === 3
                        ? (theme === 'dark' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200')
                        : (theme === 'dark' ? 'bg-dark-700 text-dark-text-tertiary border-[#2a2a2a]' : 'bg-white text-slate-400 border-slate-100');

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
                      <td className="px-2 py-1.5 overflow-hidden">
                        <div className={`relative h-11 w-full overflow-visible rounded-2xl border ${theme === 'dark' ? 'border-[#2a2a2a] bg-dark-700/70' : 'border-slate-200/60 bg-slate-100/70'}`}>
                          {/* Track stripes */}
                          <div className={`absolute inset-0 rounded-2xl opacity-30`} style={{ backgroundImage: theme === 'dark' ? 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 60px)' : 'repeating-linear-gradient(90deg, rgba(148,163,184,0.13) 0, rgba(148,163,184,0.13) 1px, transparent 1px, transparent 60px)' }} />

                          {/* Watermark (Name | Score) */}
                          <div
                            className={`absolute inset-y-0 flex items-center z-10 pointer-events-none transition-all duration-700 ease-in-out ${progress > 30 ? 'left-4' : 'left-1/2 -translate-x-1/2'
                              }`}
                          >
                            <span className={`text-[15px] font-black uppercase tracking-widest drop-shadow-sm truncate max-w-[250px] ${theme === 'dark' ? 'text-dark-text-secondary/80' : 'text-slate-600/80'}`}>
                              {player.name} <span className="mx-2 opacity-50">|</span> {player.score}
                            </span>
                          </div>

                          {/* Filled progress */}
                          <div
                            className={`absolute inset-y-0 left-0 rounded-2xl bg-gradient-to-r ${skin.trackFillClass} opacity-20 transition-[width] duration-500 ease-out z-0`}
                            style={{ width: `${progress}%` }}
                          />

                          {/* Horse + crown */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 flex items-center transition-[left] duration-500 ease-out z-20"
                            style={{ left: `clamp(4px, calc(${progress}% - 28px), calc(100% - 60px))` }}
                          >
                            <div className="relative flex flex-col items-center justify-center">
                              {/* Crown for top 3 – animated */}
                              {isTop3 && (
                                <div
                                  ref={(el) => { crownRefs.current[player.id] = el; }}
                                  className="absolute right-[-28px] top-1/2 -translate-y-1/2 text-[22px] drop-shadow-md transition-all duration-300 z-30"
                                >
                                  <CrownIcon rank={rank as 1 | 2 | 3} />
                                </div>
                              )}
                              {/* Horse — two nested divs: outer for scale, inner for gallop */}
                              <div
                                ref={(el) => { horseScaleRefs.current[player.id] = el; }}
                                className="relative flex items-center justify-center"
                              >
                                <div
                                  ref={(el) => { horseGallopRefs.current[player.id] = el; }}
                                  className="relative"
                                >
                                  <HorseAvatar colors={skin.horse} mount={skin.mount} size="lg" className="drop-shadow-md" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Finish line */}
                          <div className={`absolute right-0 top-0 bottom-0 w-[3px] rounded-r-2xl opacity-40 z-10`} style={{ backgroundImage: theme === 'dark' ? 'repeating-linear-gradient(180deg,#64748b_0,#64748b_3px,#1e293b_3px,#1e293b_6px)' : 'repeating-linear-gradient(180deg,#1e293b_0,#1e293b_3px,white_3px,white_6px)' }} />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5 text-center">
                        {isFinished ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${theme === 'dark' ? 'bg-accent-green/20 text-accent-green' : 'bg-green-100 text-green-700'}`}>
                            ✓ Selesai
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${theme === 'dark' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-blue-50 text-blue-500'}`}>
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
        <div className={`border-t px-4 py-2 ${theme === 'dark' ? 'border-[#2a2a2a] bg-dark-750' : 'border-slate-200 bg-slate-50'}`}>
          <div className={`flex items-center justify-center text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>
            <span>{fixedOrderPlayers.length} peserta</span>
          </div>
        </div>
      </div>
    </div>
  );
}