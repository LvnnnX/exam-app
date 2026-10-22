'use client';

import React, { useState } from 'react';
import { useQuizLive } from '@/src/features/kuis/hooks/useQuizLive';
import { joinQuizAction } from '@/src/features/kuis/actions';
import StudentWaitingRoom from '@/src/features/kuis/components/StudentWaitingRoom';
import StudentQuizRuntime from '@/src/features/kuis/components/StudentQuizRuntime';
import StudentLeaderboard from '@/src/features/kuis/components/StudentLeaderboard';
import { AlertCircle, Pause, User, ArrowRight } from 'lucide-react';

interface QuizRoomClientProps {
  code: string;
}

interface StoredPlayer {
  playerId: string;
  quizId: string;
  name: string;
  skin: string | null;
}

export default function QuizRoomClient({ code }: QuizRoomClientProps) {
  const { quiz, players, isConnected: _isConnected, refresh } = useQuizLive({ code });

  // Player session state (KL-17: Pulih setelah Refresh)
  const [playerData, setPlayerData] = useState<StoredPlayer | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`quiz_player_${code}`);
        if (stored) return JSON.parse(stored);
      }
    } catch {
      // LocalStorage access failure
    }
    return null;
  });
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isSelfFinished, setIsSelfFinished] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) {
      setJoinError('Nama tidak boleh kosong');
      return;
    }
    if (joinName.length > 24) {
      setJoinError('Nama maksimal 24 karakter');
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await joinQuizAction(code, joinName.trim());
      if (!res.success || !res.player_id) {
        setJoinError(res.error || 'Gagal bergabung dengan kuis');
        return;
      }

      const newPlayerData: StoredPlayer = {
        playerId: res.player_id,
        quizId: res.quiz_id!,
        name: res.name!,
        skin: res.skin || null,
      };

      localStorage.setItem(`quiz_player_${code}`, JSON.stringify(newPlayerData));
      setPlayerData(newPlayerData);
      refresh();
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsJoining(false);
    }
  };

  const handleSkinUpdate = (newSkin: string) => {
    if (playerData) {
      const updated = { ...playerData, skin: newSkin };
      setPlayerData(updated);
      localStorage.setItem(`quiz_player_${code}`, JSON.stringify(updated));
    }
  };

  if (!quiz) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 text-center glass-card rounded-3xl border border-line flex flex-col items-center gap-3">
        <AlertCircle size={28} className="text-danger" />
        <h3 className="font-bold text-fg text-base">Kuis Tidak Ditemukan</h3>
        <p className="text-xs text-fg-subtle">
          Kode kuis <span className="font-mono font-bold text-primary">{code}</span> tidak valid atau telah berakhir.
        </p>
      </div>
    );
  }

  // If student hasn't joined this quiz yet, show prompt
  if (!playerData) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-3xl glass-card border border-line shadow-sm flex flex-col gap-5">
        <div className="text-center">
          <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider block">
            Gabung Sesi Kuis Live
          </span>
          <h2 className="text-3xl font-black font-mono text-primary mt-1">{code}</h2>
          <p className="text-xs text-fg-subtle mt-1">
            Masukkan nama Anda untuk bergabung ke dalam ruang tunggu
          </p>
        </div>

        {joinError && (
          <div className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs">
            {joinError}
          </div>
        )}

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-fg-subtle block mb-1">Nama Lengkap / Panggilan</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-3.5 text-fg-subtle" />
              <input
                type="text"
                maxLength={24}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl well border border-line text-xs font-semibold text-fg focus:outline-hidden focus:border-primary"
                required
              />
            </div>
            <span className="text-[10px] text-fg-subtle mt-1 block">Maksimal 24 karakter, huruf kapital dijaga</span>
          </div>

          <button
            type="submit"
            disabled={isJoining}
            className="w-full py-3 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isJoining ? <span>Bergabung...</span> : <span>Gabung Kuis Sekarang</span>}
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    );
  }

  // Check if player has finished in live state
  const liveMe = players.find((p) => p.id === playerData.playerId);
  const isFinished = isSelfFinished || Boolean(liveMe?.is_finished) || quiz.status === 'finished';

  // 1. Finished View (KL-14, KL-15)
  if (isFinished) {
    return (
      <StudentLeaderboard
        quiz={quiz}
        players={players}
        currentPlayerId={playerData.playerId}
      />
    );
  }

  // 2. Waiting Room (KL-11)
  if (quiz.status === 'waiting') {
    return (
      <StudentWaitingRoom
        quiz={quiz}
        players={players}
        currentPlayerId={playerData.playerId}
        currentPlayerName={playerData.name}
        currentSkin={playerData.skin}
        onSkinChange={handleSkinUpdate}
      />
    );
  }

  // 3. Active Quiz (KL-12, KL-13) or Paused Overlay
  return (
    <div className="relative w-full">
      {quiz.status === 'paused' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl glass-card border border-warning/40 shadow-2xl text-center max-w-sm flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-warning/20 text-warning flex items-center justify-center">
              <Pause size={24} />
            </div>
            <h3 className="font-bold text-fg text-base">Kuis Sedang Dijeda</h3>
            <p className="text-xs text-fg-subtle leading-relaxed">
              Admin sedang menjeda kuis sementara waktu. Waktu pengerjaan akan dilanjutkan kembali saat admin melanjutkan kuis.
            </p>
          </div>
        </div>
      )}

      <StudentQuizRuntime
        quiz={quiz}
        playerId={playerData.playerId}
        playerName={playerData.name}
        onFinished={() => setIsSelfFinished(true)}
      />
    </div>
  );
}
