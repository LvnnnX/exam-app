'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { joinQuizAction } from '@/src/features/kuis/actions';
import { Shield, Sparkles, User, Hash, ArrowRight, AlertCircle, BookCheck } from 'lucide-react';

export default function HomeClient() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = code.trim();
    const cleanName = name.trim();

    if (!cleanCode || cleanCode.length !== 6 || !/^\d+$/.test(cleanCode)) {
      setErrorMessage('Kode kuis harus berupa 6 digit angka');
      return;
    }

    if (!cleanName) {
      setErrorMessage('Nama siswa tidak boleh kosong');
      return;
    }

    if (cleanName.length > 24) {
      setErrorMessage('Nama maksimal 24 karakter');
      return;
    }

    setIsJoining(true);
    try {
      const res = await joinQuizAction(cleanCode, cleanName);
      if (!res.success || !res.player_id) {
        setErrorMessage(res.error || 'Gagal bergabung dengan kuis');
        return;
      }

      // Store identity in localStorage (KL-17)
      const playerData = {
        playerId: res.player_id,
        quizId: res.quiz_id!,
        name: res.name!,
        skin: res.skin || null,
      };
      localStorage.setItem(`quiz_player_${cleanCode}`, JSON.stringify(playerData));

      // Route to quiz room
      router.push(`/kuis/${cleanCode}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="w-full min-h-[85vh] flex flex-col justify-between py-6 px-4">
      {/* Top Header */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between p-4 rounded-3xl glass border border-line shadow-xs">
        <div className="flex items-center gap-2.5 font-black text-fg text-base">
          <span className="p-2 rounded-2xl bg-primary text-white clay-primary">
            <Sparkles size={18} />
          </span>
          <span>ExamApp v2</span>
        </div>

        <Link
          href="/admin/kuis"
          className="min-h-[44px] px-3.5 py-2 rounded-2xl well hover:bg-well/80 border border-line text-xs font-bold text-fg flex items-center gap-1.5 transition-colors"
        >
          <Shield size={14} className="text-primary" />
          <span>Portal Admin</span>
        </Link>
      </header>

      {/* Hero Form: Join Kuis Live (KL-10) */}
      <main className="w-full max-w-md mx-auto my-auto flex flex-col gap-5">
        <div className="p-6 sm:p-8 rounded-3xl glass-card border border-line shadow-sm flex flex-col gap-5 text-center">
          <div>
            <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider block">
              Platform Ujian & Kuis Interaktif
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-fg mt-1">Gabung Kuis Live</h1>
            <p className="text-xs text-fg-subtle mt-1.5 leading-relaxed">
              Masukkan 6 digit kode kuis dari gurumu dan nama lengkapmu untuk mulai bertanding.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2 text-left">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="flex flex-col gap-4 text-left">
            <div>
              <label className="text-xs font-bold text-fg-subtle block mb-1">
                Kode Kuis (6 Digit Angka)
              </label>
              <div className="relative">
                <Hash size={18} className="absolute left-3.5 top-3.5 text-primary" />
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 528093"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl well border border-line font-mono font-bold text-lg text-fg tracking-widest focus:outline-hidden focus:border-primary placeholder:font-normal placeholder:tracking-normal placeholder:text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-fg-subtle block mb-1">
                Nama Lengkap Siswa
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-3 text-fg-subtle" />
                <input
                  type="text"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Putu Dani"
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl well border border-line text-xs font-semibold text-fg focus:outline-hidden focus:border-primary"
                  required
                />
              </div>
              <span className="text-[10px] text-fg-subtle mt-1 block">
                Maksimal 24 karakter, huruf kapital dijaga
              </span>
            </div>

            <button
              type="submit"
              disabled={isJoining}
              className="w-full mt-2 min-h-[44px] py-3 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isJoining ? (
                <span>Menghubungkan ke Sesi...</span>
              ) : (
                <>
                  <span>Masuk ke Ruang Kuis</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Kartu Ujian Mandiri (Exam & Survival) */}
        <div className="p-5 sm:p-6 rounded-3xl glass-card border border-line shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <span className="p-2.5 rounded-2xl well text-primary border border-line">
              <BookCheck size={20} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-fg">Ujian Mandiri</h2>
              <p className="text-[11px] text-fg-subtle">
                Latihan mandiri mode Exam atau Survival sesuai sub-bab pilihanmu.
              </p>
            </div>
          </div>
          <Link
            href="/ujian"
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center gap-1.5 shrink-0"
          >
            <span>Mulai</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-fg-subtle">
        SMAN 2 Amlapura • Remake v2 • Bebas Slop
      </footer>
    </div>
  );
}
