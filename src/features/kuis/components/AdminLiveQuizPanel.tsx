'use client';

import React, { useState } from 'react';
import { useQuizLive } from '../hooks/useQuizLive';
import { updateQuizStatusAction } from '../actions';
import MountAvatar from './MountAvatar';
import PlayerAnswersModal from './PlayerAnswersModal';
import RaceViewButton from '@/src/features/race/components/RaceViewButton';
import type { LivePlayerProgress } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Ban,
  Users,
  Copy,
  Check,
  Trophy,
  Clock,
  Sparkles,
  Eye,
  FileCheck2,
} from 'lucide-react';

interface AdminLiveQuizPanelProps {
  quizCode: string;
  onFinishedOrCancelled?: () => void;
}

export default function AdminLiveQuizPanel({
  quizCode,
  onFinishedOrCancelled,
}: AdminLiveQuizPanelProps) {
  const { quiz, players, isConnected } = useQuizLive({ code: quizCode });
  const [isActing, setIsActing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inspectPlayer, setInspectPlayer] = useState<LivePlayerProgress | null>(null);

  if (!quiz) {
    return (
      <div className="p-8 text-center glass-card rounded-3xl border border-line">
        <p className="text-xs text-fg-subtle animate-pulse">Memuat data kuis {quizCode}...</p>
      </div>
    );
  }

  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'finish' | 'cancel') => {
    if (action === 'cancel' && !confirm('Yakin ingin membatalkan kuis ini?')) return;
    if (action === 'finish' && !confirm('Yakin ingin mengakhiri kuis untuk semua pemain?')) return;

    setIsActing(true);
    try {
      await updateQuizStatusAction(quiz.id, action);
      if ((action === 'finish' || action === 'cancel') && onFinishedOrCancelled) {
        onFinishedOrCancelled();
      }
    } finally {
      setIsActing(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(quiz.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const questionTotal = quiz.config?.question_count || 10;
  const finishedCount = players.filter((p) => p.is_finished).length;
  const avgScore = players.length > 0
    ? (players.reduce((acc, p) => acc + p.score, 0) / players.length).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* Top Banner Card: Code & Controls */}
      <div className="p-6 rounded-3xl glass-card border border-line shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="text-center md:text-left">
            <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider block">
              Kode Kuis Siswa
            </span>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-primary drop-shadow-xs">
                {quiz.code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2.5 rounded-2xl well hover:bg-well/80 border border-line text-fg transition-all"
                title="Salin Kode"
              >
                {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                  quiz.status === 'active'
                    ? 'bg-success/15 border-success/30 text-success'
                    : quiz.status === 'paused'
                    ? 'bg-warning/15 border-warning/30 text-warning'
                    : quiz.status === 'finished'
                    ? 'bg-ink-100 border-line text-fg-subtle'
                    : 'bg-primary/15 border-primary/30 text-primary'
                }`}
              >
                Status: {quiz.status}
              </span>
              <span className="text-[11px] text-fg-muted font-mono">
                {quiz.config?.quiz_mode?.toUpperCase()} • {quiz.config?.duration_minutes} MNT • {questionTotal} SOAL
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-success animate-pulse' : 'bg-danger'
                }`}
                title={isConnected ? 'Realtime Connected' : 'Disconnected'}
              />
            </div>
          </div>
        </div>

        {/* Action Controls (KL-04) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {quiz.status !== 'waiting' && quiz.status !== 'cancelled' && (
            <RaceViewButton quiz={quiz} players={players} />
          )}

          {quiz.status === 'waiting' && (
            <button
              onClick={() => handleAction('start')}
              disabled={isActing}
              className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Play size={16} />
              <span>Mulai Kuis</span>
            </button>
          )}

          {quiz.status === 'active' && (
            <>
              <button
                onClick={() => handleAction('pause')}
                disabled={isActing}
                className="px-4 py-2.5 rounded-2xl bg-warning/20 border border-warning/40 text-warning text-xs font-bold hover:bg-warning/30 transition-colors flex items-center gap-1.5"
              >
                <Pause size={16} />
                <span>Jeda Kuis</span>
              </button>
              <button
                onClick={() => handleAction('finish')}
                disabled={isActing}
                className="px-4 py-2.5 rounded-2xl bg-danger/20 border border-danger/40 text-danger text-xs font-bold hover:bg-danger/30 transition-colors flex items-center gap-1.5"
              >
                <Square size={16} />
                <span>Akhiri Kuis</span>
              </button>
            </>
          )}

          {quiz.status === 'paused' && (
            <>
              <button
                onClick={() => handleAction('resume')}
                disabled={isActing}
                className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center gap-2 shadow-sm"
              >
                <RotateCcw size={16} />
                <span>Lanjutkan Kuis</span>
              </button>
              <button
                onClick={() => handleAction('finish')}
                disabled={isActing}
                className="px-4 py-2.5 rounded-2xl bg-danger/20 border border-danger/40 text-danger text-xs font-bold hover:bg-danger/30 transition-colors flex items-center gap-1.5"
              >
                <Square size={16} />
                <span>Akhiri Kuis</span>
              </button>
            </>
          )}

          {quiz.status !== 'finished' && quiz.status !== 'cancelled' && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={isActing}
              className="p-2.5 rounded-2xl well hover:bg-brick-50 border border-line text-fg-subtle hover:text-danger transition-colors"
              title="Batalkan Kuis"
            >
              <Ban size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl glass border border-line shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
            <Users size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-fg">{players.length}</div>
            <div className="text-[11px] text-fg-subtle font-medium">Siswa Terdaftar</div>
          </div>
        </div>

        <div className="p-4 rounded-3xl glass border border-line shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-success/10 text-success">
            <FileCheck2 size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-fg">{finishedCount} / {players.length}</div>
            <div className="text-[11px] text-fg-subtle font-medium">Selesai Mengerjakan</div>
          </div>
        </div>

        <div className="p-4 rounded-3xl glass border border-line shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
            <Trophy size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-fg">{avgScore}</div>
            <div className="text-[11px] text-fg-subtle font-medium">Rata-rata Skor</div>
          </div>
        </div>

        <div className="p-4 rounded-3xl glass border border-line shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-ink-200/50 text-fg-subtle">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-fg font-mono">
              {quiz.expires_at ? new Date(quiz.expires_at).toLocaleTimeString('id-ID') : '-'}
            </div>
            <div className="text-[11px] text-fg-subtle font-medium">Batas Waktu</div>
          </div>
        </div>
      </div>

      {/* Realtime Players Table (KL-06) */}
      <div className="rounded-3xl glass-card border border-line overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h3 className="font-bold text-fg text-sm">Leaderboard & Progress Siswa Live</h3>
          </div>
          <span className="text-xs text-fg-subtle font-mono">
            Diperbarui realtime via SSE/Polling
          </span>
        </div>

        {players.length === 0 ? (
          <div className="p-10 text-center text-fg-subtle text-xs">
            Belum ada siswa yang bergabung. Bagikan kode <span className="font-mono font-bold text-primary">{quiz.code}</span> ke siswa!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="well border-b border-line text-fg-subtle font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4 text-center">Progress</th>
                  <th className="py-3 px-4 text-center">Skor</th>
                  <th className="py-3 px-4 text-center">Total Waktu</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center w-16">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {players.map((p, idx) => {
                  const pct = questionTotal > 0 ? Math.min(100, Math.round((p.current_index / questionTotal) * 100)) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-well/40 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-fg-subtle font-mono">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <MountAvatar skin={p.skin} size="sm" />
                          <div className="font-bold text-fg">{p.name}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-well rounded-full h-2 overflow-hidden border border-line">
                            <div
                              className="bg-primary h-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-fg-muted">{p.current_index}/{questionTotal}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold font-mono text-sm text-primary">{p.score}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-fg-subtle">
                        {p.total_time}s
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.is_finished
                              ? 'bg-success/15 border-success/30 text-success'
                              : 'bg-primary/10 border-primary/20 text-primary'
                          }`}
                        >
                          {p.is_finished ? 'Selesai' : 'Mengerjakan'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setInspectPlayer(p)}
                          className="p-1.5 rounded-xl well hover:bg-well/80 border border-line text-fg-subtle hover:text-primary transition-colors"
                          title="Lihat Jawaban"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {inspectPlayer && (
        <PlayerAnswersModal player={inspectPlayer} onClose={() => setInspectPlayer(null)} />
      )}
    </div>
  );
}
