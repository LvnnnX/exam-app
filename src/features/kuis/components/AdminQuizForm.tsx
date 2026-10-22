'use client';

import React, { useState, useEffect } from 'react';
import { createQuizAction } from '../actions';
import { getCategoryTreeAction } from '@/src/features/kategori/actions';
import type { QuizMode } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, Sliders, Layers, Clock, Hash, Lock, Unlock } from 'lucide-react';

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  chapters?: Array<{
    id: string;
    name: string;
    slug: string;
    topics?: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
  }>;
}

interface AdminQuizFormProps {
  onSuccess: (code: string) => void;
}

export default function AdminQuizForm({ onSuccess }: AdminQuizFormProps) {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  // Form states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [quizMode, setQuizMode] = useState<QuizMode>('strict');
  const [allowMidGame, setAllowMidGame] = useState<boolean>(false);
  const [useCustomWeights, setUseCustomWeights] = useState<boolean>(false);
  const [weights, setWeights] = useState<Record<string, number>>({});

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [guardModalMsg, setGuardModalMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCats = async () => {
      setIsLoadingCats(true);
      const res = await getCategoryTreeAction();
      if (active && res.success && res.tree) {
        setCategories(res.tree as CategoryNode[]);
      }
      if (active) setIsLoadingCats(false);
    };
    fetchCats();
    return () => { active = false; };
  }, []);

  const currentSubject = categories.find((s) => s.id === selectedSubjectId);
  const currentChapter = currentSubject?.chapters?.find((c) => c.id === selectedChapterId);
  const availableTopics = currentChapter?.topics || [];

  const handleSubjectChange = (val: string) => {
    setSelectedSubjectId(val);
    setSelectedChapterId('all');
    setSelectedTopicIds([]);
    setWeights({});
  };

  const handleChapterChange = (val: string) => {
    setSelectedChapterId(val);
    setSelectedTopicIds([]);
    setWeights({});
  };

  const toggleTopic = (tid: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid]
    );
  };

  const handleSelectAllTopics = () => {
    if (availableTopics.length === 0) return;
    if (selectedTopicIds.length === availableTopics.length) {
      setSelectedTopicIds([]);
    } else {
      setSelectedTopicIds(availableTopics.map((t) => t.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setGuardModalMsg(null);

    // Validation
    if (questionCount <= 0) {
      setErrorMessage('Jumlah soal harus lebih dari 0');
      return;
    }
    if (durationMinutes <= 0) {
      setErrorMessage('Durasi harus lebih dari 0 menit');
      return;
    }

    // Weight validation if enabled
    let finalWeights: Record<string, number> | undefined = undefined;
    if (useCustomWeights && selectedTopicIds.length > 0) {
      const sum = Object.values(weights).reduce((a, b) => a + (b || 0), 0);
      if (sum !== 100) {
        setErrorMessage(`Total bobot persentase sub-bab harus 100% (saat ini ${sum}%)`);
        return;
      }
      finalWeights = weights;
    }

    setIsSubmitting(true);
    try {
      const res = await createQuizAction({
        topic_ids: selectedTopicIds,
        question_count: questionCount,
        duration_minutes: durationMinutes,
        quiz_mode: quizMode,
        allow_join_mid_game: allowMidGame,
        weights: finalWeights,
      });

      if (!res.success) {
        if (res.error?.includes('Hanya tersedia')) {
          setGuardModalMsg(res.error);
        } else {
          setErrorMessage(res.error || 'Gagal membuat sesi kuis');
        }
        return;
      }

      if (res.code) {
        onSuccess(res.code);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-3xl glass-card border border-line p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 pb-5 border-b border-line mb-6">
        <span className="p-3 rounded-2xl bg-primary text-white clay-primary">
          <Sparkles size={20} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-fg">Buat Sesi Kuis Live</h2>
          <p className="text-xs text-fg-subtle">
            Siapkan topik, konfigurasi aturan, dan buat kode unik 6 digit untuk siswa
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2 mb-6">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KL-02: Guard Modal */}
      {guardModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl glass-card border border-line p-6 shadow-xl flex flex-col gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-danger/15 text-danger flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <div>
              <h3 className="font-bold text-fg text-base">Soal Tidak Mencukupi</h3>
              <p className="text-xs text-fg-subtle mt-1.5 leading-relaxed">{guardModalMsg}</p>
            </div>
            <p className="text-[11px] text-fg-muted well p-3 rounded-2xl border border-line">
              Silakan kurangi jumlah soal yang diminta, atau pilih lebih banyak sub-bab/kategori untuk memperluas pool soal aktif.
            </p>
            <button
              onClick={() => setGuardModalMsg(null)}
              className="w-full py-2.5 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Kategori Selection */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-fg-subtle uppercase tracking-wider">
            <Layers size={14} className="text-primary" />
            <span>Pilih Cakupan Materi</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-fg-muted block mb-1">Mata Pelajaran</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl well border border-line text-xs font-medium text-fg focus:outline-hidden focus:border-primary"
                disabled={isLoadingCats}
              >
                <option value="all">Semua Mata Pelajaran</option>
                {categories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-fg-muted block mb-1">Bab</label>
              <select
                value={selectedChapterId}
                onChange={(e) => handleChapterChange(e.target.value)}
                disabled={selectedSubjectId === 'all'}
                className="w-full px-3.5 py-2.5 rounded-2xl well border border-line text-xs font-medium text-fg focus:outline-hidden focus:border-primary disabled:opacity-50"
              >
                <option value="all">Semua Bab</option>
                {currentSubject?.chapters?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub-bab list */}
          {selectedChapterId !== 'all' && availableTopics.length > 0 && (
            <div className="mt-2 p-3.5 rounded-2xl well border border-line flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-fg">Pilih Sub-bab</span>
                <button
                  type="button"
                  onClick={handleSelectAllTopics}
                  className="text-primary font-semibold text-[11px] hover:underline"
                >
                  {selectedTopicIds.length === availableTopics.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableTopics.map((topic) => {
                  const isChecked = selectedTopicIds.includes(topic.id);
                  return (
                    <label
                      key={topic.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-primary/10 border-primary text-fg font-semibold' : 'border-line text-fg-subtle hover:bg-well'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTopic(topic.id)}
                        className="rounded text-primary focus:ring-0"
                      />
                      <span className="truncate">{topic.name}</span>
                    </label>
                  );
                })}
              </div>

              {/* Opsional: Bobot persen per sub-bab */}
              {selectedTopicIds.length > 1 && (
                <div className="mt-2 pt-2 border-t border-line/60">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-fg cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={useCustomWeights}
                      onChange={(e) => setUseCustomWeights(e.target.checked)}
                      className="rounded text-primary"
                    />
                    <span>Atur bobot persentase soal per sub-bab (total harus 100%)</span>
                  </label>

                  {useCustomWeights && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedTopicIds.map((tid) => {
                        const t = availableTopics.find((item) => item.id === tid);
                        return (
                          <div key={tid} className="flex items-center gap-1.5 p-1.5 rounded-lg well border border-line">
                            <span className="text-[10px] font-medium text-fg truncate flex-1">{t?.name}</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={weights[tid] || ''}
                              onChange={(e) => setWeights({ ...weights, [tid]: Number(e.target.value) })}
                              placeholder="%"
                              className="w-12 px-1 py-0.5 rounded text-[11px] text-right well border border-line text-fg"
                            />
                            <span className="text-[10px] text-fg-subtle">%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Setting Jumlah & Waktu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-fg-subtle block mb-1">
              <Hash size={13} className="text-primary" />
              <span>Jumlah Soal</span>
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2.5 rounded-2xl well border border-line text-xs font-semibold text-fg focus:outline-hidden focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-fg-subtle block mb-1">
              <Clock size={13} className="text-primary" />
              <span>Durasi Pengerjaan (Menit)</span>
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2.5 rounded-2xl well border border-line text-xs font-semibold text-fg focus:outline-hidden focus:border-primary"
              required
            />
          </div>
        </div>

        {/* Mode Kuis & Mid-game Join */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="text-xs font-bold text-fg-subtle uppercase tracking-wider flex items-center gap-2">
            <Sliders size={14} className="text-primary" />
            <span>Aturan & Navigasi</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Strict */}
            <div
              onClick={() => setQuizMode('strict')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                quizMode === 'strict'
                  ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/20'
                  : 'border-line glass hover:bg-well'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-fg">
                <Lock size={14} className="text-primary" />
                <span>Mode Strict</span>
              </div>
              <p className="text-[11px] text-fg-subtle mt-1 leading-relaxed">
                Soal dikerjakan berurutan satu per satu. Siswa tidak dapat kembali ke soal sebelumnya.
              </p>
            </div>

            {/* Standard */}
            <div
              onClick={() => setQuizMode('standard')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                quizMode === 'standard'
                  ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/20'
                  : 'border-line glass hover:bg-well'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-fg">
                <Unlock size={14} className="text-highlight" />
                <span>Mode Standard</span>
              </div>
              <p className="text-[11px] text-fg-subtle mt-1 leading-relaxed">
                Siswa dapat berpindah nomor secara bebas, mengubah jawaban, dan menandai ragu-ragu.
              </p>
            </div>
          </div>

          {/* Toggle mid-game join */}
          <label className="flex items-center gap-2.5 p-3 rounded-2xl well border border-line cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={allowMidGame}
              onChange={(e) => setAllowMidGame(e.target.checked)}
              className="rounded text-primary focus:ring-0"
            />
            <div>
              <span className="text-xs font-bold text-fg block">Izinkan Gabung di Tengah Kuis</span>
              <span className="text-[11px] text-fg-subtle">
                Siswa baru tetap dapat bergabung meskipun kuis sudah dimulai
              </span>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-3 py-3 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Memvalidasi & Membuat Kuis...</span>
          ) : (
            <>
              <CheckCircle2 size={16} />
              <span>Buat Sesi Kuis (Generate Kode 6 Digit)</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
