'use client';

import React, { useState } from 'react';
import type { Quiz } from '../types';
import AdminLiveQuizPanel from './AdminLiveQuizPanel';
import { History, Eye, Calendar, Award, Hash, Clock, X } from 'lucide-react';

interface AdminQuizHistoryProps {
  initialHistory: Quiz[];
}

export default function AdminQuizHistory({ initialHistory }: AdminQuizHistoryProps) {
  const [history] = useState<Quiz[]>(initialHistory);
  const [selectedQuizCode, setSelectedQuizCode] = useState<string | null>(null);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <div className="p-6 rounded-3xl glass-card border border-line shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-primary text-white clay-primary">
            <History size={20} />
          </span>
          <div>
            <h3 className="font-bold text-fg text-lg">Riwayat Kuis Selesai</h3>
            <p className="text-xs text-fg-subtle">
              Daftar seluruh sesi kuis yang telah selesai. Buka untuk melihat rekap leaderboard dan audit jawaban.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold well px-3 py-1 rounded-full border border-line text-primary">
          {history.length} Sesi
        </span>
      </div>

      {history.length === 0 ? (
        <div className="p-12 text-center glass-card rounded-3xl border border-line">
          <p className="text-xs text-fg-subtle">Belum ada riwayat kuis yang selesai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history.map((q) => (
            <div
              key={q.id}
              className="p-5 rounded-3xl glass-card border border-line hover:border-primary/40 transition-all flex flex-col justify-between gap-4 shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-mono font-bold text-primary tracking-wider">
                    {q.code}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full well border border-line text-fg-subtle uppercase">
                    {q.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-fg-subtle">
                  <span className="flex items-center gap-1">
                    <Hash size={13} className="text-primary" />
                    <span>{q.config?.question_count || 0} Soal</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-primary" />
                    <span>{q.config?.duration_minutes || 0} Mnt</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Award size={13} className="text-primary" />
                    <span className="capitalize">{q.config?.quiz_mode}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-primary" />
                    <span>
                      {q.finished_at ? new Date(q.finished_at).toLocaleDateString('id-ID') : '-'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex justify-end">
                <button
                  onClick={() => setSelectedQuizCode(q.code)}
                  className="px-4 py-2 rounded-2xl well hover:bg-well/80 border border-line text-xs font-bold text-fg flex items-center gap-1.5 transition-colors"
                >
                  <Eye size={14} className="text-primary" />
                  <span>Buka Rekap & Jawaban</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail Rekap Kuis */}
      {selectedQuizCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-5xl rounded-3xl glass-card border border-line p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h4 className="font-bold text-fg text-base">
                Detail Rekap Kuis: <span className="font-mono text-primary">{selectedQuizCode}</span>
              </h4>
              <button
                onClick={() => setSelectedQuizCode(null)}
                className="p-2 rounded-2xl well hover:bg-brick-50 text-fg-subtle hover:text-danger transition-colors border border-line"
              >
                <X size={18} />
              </button>
            </div>

            <AdminLiveQuizPanel quizCode={selectedQuizCode} />
          </div>
        </div>
      )}
    </div>
  );
}
