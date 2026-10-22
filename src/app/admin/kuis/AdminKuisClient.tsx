'use client';

import React, { useState } from 'react';
import type { Quiz } from '@/src/features/kuis/types';
import AdminQuizForm from '@/src/features/kuis/components/AdminQuizForm';
import AdminLiveQuizPanel from '@/src/features/kuis/components/AdminLiveQuizPanel';
import AdminQuizHistory from '@/src/features/kuis/components/AdminQuizHistory';
import { refreshActiveQuizzesAction } from '@/src/features/kuis/actions';
import { Radio, PlusCircle, History, Sparkles } from 'lucide-react';

interface AdminKuisClientProps {
  initialActiveQuizzes: Quiz[];
  initialHistory: Quiz[];
}

export default function AdminKuisClient({
  initialActiveQuizzes,
  initialHistory,
}: AdminKuisClientProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'create' | 'history'>(
    initialActiveQuizzes.length > 0 ? 'live' : 'create'
  );
  const [activeQuizzes, setActiveQuizzes] = useState<Quiz[]>(initialActiveQuizzes);
  const [selectedQuizCode, setSelectedQuizCode] = useState<string>(
    initialActiveQuizzes[0]?.code || ''
  );

  const refreshList = async () => {
    const res = await refreshActiveQuizzesAction();
    if (res.success && res.quizzes) {
      setActiveQuizzes(res.quizzes);
      if (res.quizzes.length > 0 && !res.quizzes.find((q) => q.code === selectedQuizCode)) {
        setSelectedQuizCode(res.quizzes[0].code);
      }
    }
  };

  const handleCreated = async (code: string) => {
    await refreshList();
    setSelectedQuizCode(code);
    setActiveTab('live');
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Navigation Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-2 rounded-3xl glass border border-line shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'live'
                ? 'bg-primary text-white clay-primary shadow-xs'
                : 'text-fg-subtle hover:text-fg hover:bg-well'
            }`}
          >
            <Radio size={15} />
            <span>Kuis Aktif ({activeQuizzes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'create'
                ? 'bg-primary text-white clay-primary shadow-xs'
                : 'text-fg-subtle hover:text-fg hover:bg-well'
            }`}
          >
            <PlusCircle size={15} />
            <span>Buat Kuis Baru</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'history'
                ? 'bg-primary text-white clay-primary shadow-xs'
                : 'text-fg-subtle hover:text-fg hover:bg-well'
            }`}
          >
            <History size={15} />
            <span>Riwayat Kuis</span>
          </button>
        </div>

        {activeTab === 'live' && activeQuizzes.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-subtle font-medium">Pilih Kuis:</span>
            <select
              value={selectedQuizCode}
              onChange={(e) => setSelectedQuizCode(e.target.value)}
              className="px-3 py-1.5 rounded-xl well border border-line text-xs font-mono font-bold text-fg focus:outline-hidden"
            >
              {activeQuizzes.map((q) => (
                <option key={q.id} value={q.code}>
                  {q.code} ({q.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'create' && (
        <AdminQuizForm onSuccess={handleCreated} />
      )}

      {activeTab === 'live' && (
        activeQuizzes.length === 0 ? (
          <div className="p-12 text-center glass-card rounded-3xl border border-line max-w-xl mx-auto flex flex-col items-center gap-3">
            <Sparkles size={28} className="text-primary" />
            <h3 className="font-bold text-fg text-base">Tidak Ada Kuis yang Sedang Berjalan</h3>
            <p className="text-xs text-fg-subtle">
              Belum ada sesi kuis yang berstatus waiting, active, atau paused. Buat sesi kuis baru sekarang!
            </p>
            <button
              onClick={() => setActiveTab('create')}
              className="mt-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity"
            >
              Buat Kuis Baru
            </button>
          </div>
        ) : (
          <AdminLiveQuizPanel
            quizCode={selectedQuizCode || activeQuizzes[0].code}
            onFinishedOrCancelled={refreshList}
          />
        )
      )}

      {activeTab === 'history' && (
        <AdminQuizHistory initialHistory={initialHistory} />
      )}
    </div>
  );
}
