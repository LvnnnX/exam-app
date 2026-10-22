'use client';

import React, { useState } from 'react';
import type { Quiz, LivePlayerProgress } from '../types';
import MountAvatar from './MountAvatar';
import MountPickerModal from './MountPickerModal';
import { setPlayerSkinAction } from '../actions';
import { Users, Clock, Hash, Shield, Palette } from 'lucide-react';

interface StudentWaitingRoomProps {
  quiz: Quiz;
  players: LivePlayerProgress[];
  currentPlayerId: string;
  currentPlayerName: string;
  currentSkin: string | null;
  onSkinChange: (newSkin: string) => void;
}

export default function StudentWaitingRoom({
  quiz,
  players,
  currentPlayerId,
  currentPlayerName,
  currentSkin,
  onSkinChange,
}: StudentWaitingRoomProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [updatingSkin, setUpdatingSkin] = useState(false);

  const handleSelectSkin = async (newSkin: string) => {
    setUpdatingSkin(true);
    try {
      const res = await setPlayerSkinAction(currentPlayerId, newSkin);
      if (res.success) {
        onSkinChange(newSkin);
      }
    } finally {
      setUpdatingSkin(false);
    }
  };

  const questionCount = quiz.config?.question_count || 10;
  const duration = quiz.config?.duration_minutes || 15;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Top Welcome Card */}
      <div className="p-6 sm:p-8 rounded-3xl glass-card border border-line shadow-sm text-center flex flex-col items-center gap-4">
        <div className="relative">
          <MountAvatar skin={currentSkin} size="xl" className="shadow-md" />
          <button
            onClick={() => setIsPickerOpen(true)}
            disabled={updatingSkin}
            className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-primary text-white clay-primary shadow-xs hover:scale-105 transition-transform"
            title="Ganti Hewan Tunggangan"
          >
            <Palette size={16} />
          </button>
        </div>

        <div>
          <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider block">
            Selamat Datang di Ruang Tunggu
          </span>
          <h2 className="text-2xl font-black text-fg mt-1">{currentPlayerName}</h2>
          <p className="text-xs text-primary font-semibold mt-1">
            Klik ikon kuas di atas untuk mengganti hewan tungganganmu!
          </p>
        </div>

        {/* Pulse Waiting Status */}
        <div className="w-full p-4 rounded-2xl well border border-line flex items-center justify-center gap-3">
          <span className="w-3 h-3 rounded-full bg-warning animate-ping" />
          <span className="text-xs font-bold text-fg">
            Menunggu admin memulai kuis...
          </span>
        </div>

        {/* Quiz Info Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs text-fg-subtle">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full well border border-line font-mono font-bold text-primary">
            Kode: {quiz.code}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full well border border-line">
            <Hash size={13} className="text-primary" />
            <span>{questionCount} Soal</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full well border border-line">
            <Clock size={13} className="text-primary" />
            <span>{duration} Menit</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full well border border-line capitalize">
            <Shield size={13} className="text-primary" />
            <span>Mode {quiz.config?.quiz_mode}</span>
          </span>
        </div>
      </div>

      {/* Players List Grid (KL-11) */}
      <div className="p-6 rounded-3xl glass-card border border-line shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <h3 className="font-bold text-fg text-sm">Teman yang Sudah Bergabung</h3>
          </div>
          <span className="text-xs font-mono font-bold well px-2.5 py-0.5 rounded-full border border-line text-primary">
            {players.length} Pemain
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
          {players.map((p) => {
            const isMe = p.id === currentPlayerId;
            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-2xl border flex items-center gap-2.5 transition-all ${
                  isMe
                    ? 'border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/40 font-bold'
                    : 'border-line glass'
                }`}
              >
                <MountAvatar skin={p.skin} size="sm" />
                <div className="truncate text-xs text-fg">
                  {p.name} {isMe && <span className="text-primary text-[10px]">(Kamu)</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mount Picker Modal */}
      <MountPickerModal
        currentSkin={currentSkin}
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSelectSkin}
      />
    </div>
  );
}
