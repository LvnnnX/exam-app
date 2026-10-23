'use client';

import React from 'react';
import Link from 'next/link';
import type { Quiz, LivePlayerProgress } from '../types';
import MountAvatar from './MountAvatar';
import RaceViewButton from '@/src/features/race/components/RaceViewButton';
import { Trophy, CheckCircle2, XCircle, ArrowLeft, Award } from 'lucide-react';

interface StudentLeaderboardProps {
  quiz: Quiz;
  players: LivePlayerProgress[];
  /** id as it appears in the public players list (see publicPlayerId) */
  currentPublicId: string;
}

export default function StudentLeaderboard({
  quiz,
  players,
  currentPublicId,
}: StudentLeaderboardProps) {
  const isStandard = quiz.config?.quiz_mode === 'standard';
  const totalQuestions = quiz.config?.question_count || 10;
  const passThreshold = Math.ceil(totalQuestions * 0.7);

  // Sort players (KL-15): score desc, total_time asc, joined_at asc
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.total_time !== b.total_time) return a.total_time - b.total_time;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  const myRankIndex = sortedPlayers.findIndex((p) => p.id === currentPublicId);
  const myPlayer = sortedPlayers[myRankIndex];
  const isPassed = myPlayer ? myPlayer.score >= passThreshold : false;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* My Summary Card */}
      {myPlayer && (
        <div className="p-6 sm:p-8 rounded-3xl glass-card border border-line shadow-sm text-center flex flex-col items-center gap-4">
          <div className="relative">
            <MountAvatar skin={myPlayer.skin} size="xl" className="shadow-md" />
            <span className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-amber-500 text-white clay shadow-xs">
              <Trophy size={18} />
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider block">
              Hasil Akhir Pengerjaan
            </span>
            <h2 className="text-2xl font-black text-fg mt-0.5">{myPlayer.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-full well border border-line text-primary">
                Peringkat #{myRankIndex + 1} dari {sortedPlayers.length}
              </span>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1 ${
                  isPassed
                    ? 'bg-success/15 border-success/30 text-success'
                    : 'bg-danger/15 border-danger/30 text-danger'
                }`}
              >
                {isPassed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                <span>{isPassed ? 'LULUS (>=70%)' : 'BELUM LULUS (<70%)'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full pt-2">
            <div className="p-3 rounded-2xl well border border-line">
              <div className="text-xl font-mono font-black text-primary">{myPlayer.score}</div>
              <div className="text-[10px] text-fg-subtle font-semibold uppercase">Skor Benar</div>
            </div>
            <div className="p-3 rounded-2xl well border border-line">
              <div className="text-xl font-mono font-black text-fg">{totalQuestions}</div>
              <div className="text-[10px] text-fg-subtle font-semibold uppercase">Total Soal</div>
            </div>
            <div className="p-3 rounded-2xl well border border-line">
              <div className="text-xl font-mono font-black text-fg">{myPlayer.total_time}s</div>
              <div className="text-[10px] text-fg-subtle font-semibold uppercase">Total Waktu</div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table (KL-15) */}
      <div className="p-6 rounded-3xl glass-card border border-line shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-primary" />
            <h3 className="font-bold text-fg text-base">Papan Peringkat (Leaderboard)</h3>
          </div>
          <span className="text-xs font-mono font-bold well px-2.5 py-0.5 rounded-full border border-line text-primary">
            {sortedPlayers.length} Pemain
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="well border-b border-line text-fg-subtle font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4 text-center">Skor</th>
                <th className="py-3 px-4 text-center">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {sortedPlayers.map((p, idx) => {
                const isMe = p.id === currentPublicId;
                // Standard mode: hide score if not finished yet
                const displayScore = (p.score_hidden || (isStandard && !p.is_finished && quiz.status !== 'finished')) ? '?' : p.score;
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      isMe ? 'bg-primary/10 font-bold' : 'hover:bg-well/40'
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold text-fg-subtle font-mono">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <MountAvatar skin={p.skin} size="sm" />
                        <span className="text-fg truncate">
                          {p.name} {isMe && <span className="text-primary text-[10px]">(Kamu)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold font-mono text-sm text-primary">
                        {displayScore}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-fg-subtle">
                      {p.total_time}s
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-line flex flex-wrap items-center justify-center gap-3">
          <RaceViewButton quiz={quiz} players={players} />
          <Link
            href="/"
            className="px-5 py-2.5 rounded-2xl well hover:bg-well/80 border border-line text-xs font-bold text-fg flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
