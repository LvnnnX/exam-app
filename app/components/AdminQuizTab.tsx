"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { createQuizSession, updateQuizStatus, updateQuizSchedule, fetchQuizPlayers, fetchQuizHistory, fetchActiveSessions, fetchPlayerAnswers, deleteQuizSession, type KuisLog, type Player, type KuisStatus, type KuisResult } from '@/lib/quiz';
import { fetchQuestionsByIds, fetchSubBabs, type RawQuestion, type SubBabInfo } from '@/lib/questions';
import { normalizeCategorySlug } from '@/lib/categories';
import RichContent from '@/app/components/RichContent';

export default function AdminQuizTab({ babs, subBabs, hiddenSubBabs }: { babs: string[], subBabs: { label: string, value: string }[], hiddenSubBabs: string[] }) {
  const [activeView, setActiveView] = useState<'create' | 'manage' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_quiz_active_view');
      if (saved === 'create' || saved === 'manage' || saved === 'history') return saved as any;
    }
    return 'create';
  });

  useEffect(() => {
    localStorage.setItem('admin_quiz_active_view', activeView);
  }, [activeView]);

  // Create state
  const [selectedBab, setSelectedBab] = useState<string>('Semua BAB');
  const [selectedSubBabs, setSelectedSubBabs] = useState<string[]>([]);
  const [percentagesEnabled, setPercentagesEnabled] = useState(false);
  const [subBabPercentages, setSubBabPercentages] = useState<Record<string, number>>({});
  const [isSubBabOpen, setIsSubBabOpen] = useState(false);
  const [displaySubBabs, setDisplaySubBabs] = useState<SubBabInfo[]>(subBabs);
  const [loadingSubBabs, setLoadingSubBabs] = useState(false);

  // Sync subBabs prop to displaySubBabs initially or when subBabs prop changes
  useEffect(() => {
    if (selectedBab === 'Semua BAB') {
      setDisplaySubBabs(subBabs);
    }
  }, [subBabs, selectedBab]);

  // Dynamic sub-bab loading based on selectedBab
  useEffect(() => {
    const loadFiltered = async () => {
      if (selectedBab === 'Semua BAB') {
        setDisplaySubBabs(subBabs);
        return;
      }

      setLoadingSubBabs(true);
      try {
        const filtered = await fetchSubBabs(selectedBab);
        // Filter out hidden sub-babs
        const visible = filtered.filter(sb => !hiddenSubBabs.includes(normalizeCategorySlug(sb.value)));
        setDisplaySubBabs(visible);
      } finally {
        setLoadingSubBabs(false);
      }
    };

    void loadFiltered();
  }, [selectedBab, subBabs, hiddenSubBabs]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [creating, setCreating] = useState(false);

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleCountdown, setScheduleCountdown] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editScheduleDate, setEditScheduleDate] = useState('');
  const [editScheduleTime, setEditScheduleTime] = useState('');

  // Manage state
  const [activeSession, setActiveSession] = useState<KuisLog | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerProgress, setPlayerProgress] = useState<Record<string, number>>({});

  // Player Details Modal state
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [playerAnswers, setPlayerAnswers] = useState<KuisResult[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<RawQuestion[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  const [activeSessions, setActiveSessions] = useState<KuisLog[]>([]);
  const [history, setHistory] = useState<KuisLog[]>([]);

  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [playersPage, setPlayersPage] = useState(1);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showViewQuestions, setShowViewQuestions] = useState(false);
  const [allPlayerAnswers, setAllPlayerAnswers] = useState<KuisResult[]>([]);
  const [loadingAllAnswers, setLoadingAllAnswers] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const itemsPerPage = 20;
  const historyPerPage = 10;
  const autoFinishRef = useRef(false);

  useEffect(() => {
    setActivePage(1);
    setHistoryPage(1);
    setPlayersPage(1);
  }, [activeView, activeSession]);

  useEffect(() => {
    autoFinishRef.current = false;
  }, [activeSession?.id]);

  useEffect(() => {
    let channel: any = null;

    if (activeSession) {
      // Fetch initial players
      fetchQuizPlayers(activeSession.id).then(setPlayers);

      // Subscribe to players/logs only if not finished
      if (activeSession.status !== 'finished') {
        channel = supabase
          .channel('quiz_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'player', filter: `kuis_id=eq.${activeSession.id}` },
            (payload) => {
              fetchQuizPlayers(activeSession.id).then(setPlayers);
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'kuis_logs', filter: `id=eq.${activeSession.id}` },
            (payload) => {
              setActiveSession(payload.new as KuisLog);
            }
          )
          .subscribe();
      }
    } else {
      // List View Logic
      if (activeView === 'history') {
        fetchQuizHistory().then(setHistory);
      } else if (activeView === 'manage') {
        fetchActiveSessions().then(setActiveSessions);
      }
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeView, activeSession]);

  useEffect(() => {
    if (!activeSession) {
      setPlayerProgress({});
      return;
    }

    const playerIds = players.map((p) => p.id);
    if (playerIds.length === 0) {
      setPlayerProgress({});
      return;
    }

    const loadProgress = async () => {
      const { data, error } = await supabase
        .from('kuis_results')
        .select('player_id')
        .in('player_id', playerIds);

      if (error) {
        console.error('Failed to fetch player progress:', error.message);
        return;
      }

      const counts = (data || []).reduce<Record<string, number>>((acc, row) => {
        const key = row.player_id as string;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      setPlayerProgress(counts);
    };

    void loadProgress();
  }, [activeSession, players]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') {
      autoFinishRef.current = false;
      return;
    }

    if (players.length === 0) {
      return;
    }

    const allFinished = players.every((player) => Boolean(player.finished_at));
    if (!allFinished || autoFinishRef.current) {
      return;
    }

    autoFinishRef.current = true;
    updateQuizStatus(activeSession.id, 'finished').then((ok) => {
      if (!ok) {
        autoFinishRef.current = false;
      }
    });
  }, [activeSession, players]);

  // Auto-finish timer
  useEffect(() => {
    if (activeSession && activeSession.status === 'active' && activeSession.started_at) {
      const expiresAt = new Date(activeSession.started_at).getTime() + (activeSession.duration_minutes * 60000);

      const interval = setInterval(() => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) {
          clearInterval(interval);
          updateQuizStatus(activeSession.id, 'finished');
        }
      }, 5000); // Check every 5 seconds is enough

      return () => clearInterval(interval);
    }
  }, [activeSession]);

  useEffect(() => {
    if (activeSession) {
      fetchQuestionsByIds(activeSession.question_ids || []).then(setSessionQuestions);
    } else {
      setSessionQuestions([]);
    }
  }, [activeSession]);

  useEffect(() => {
    let channel: any = null;
    if (viewingPlayer) {
      setLoadingAnswers(true);
      fetchPlayerAnswers(viewingPlayer.id).then(ans => {
        setPlayerAnswers(ans);
        setLoadingAnswers(false);
      });

      // Subscribe to live answers if session is not finished
      if (activeSession?.status !== 'finished') {
        channel = supabase.channel(`player_answers_${viewingPlayer.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'kuis_results', filter: `player_id=eq.${viewingPlayer.id}` },
            () => {
              fetchPlayerAnswers(viewingPlayer.id).then(setPlayerAnswers);
            }
          )
          .subscribe();
      }
    } else {
      setPlayerAnswers([]);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [viewingPlayer, activeSession]);

  const handleCreate = async () => {
    setCreating(true);
    let scheduledAt: string | undefined;
    if (scheduleEnabled && scheduleDate && scheduleTime) {
      const target = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (target.getTime() <= Date.now()) {
        alert('Waktu schedule tidak boleh di masa lalu.');
        setCreating(false);
        return;
      }
      scheduledAt = target.toISOString();
    }
    const effectiveSubBabs = selectedSubBabs.length > 0 ? selectedSubBabs : displaySubBabs.map(sb => sb.value);
    let subBabsToPass = selectedSubBabs;

    if (percentagesEnabled && effectiveSubBabs.length > 0) {
      subBabsToPass = effectiveSubBabs;
      const totalPct = effectiveSubBabs.reduce((acc, val) => acc + (subBabPercentages[val] || 0), 0);
      if (totalPct !== 100) {
        alert('Total persentase soal harus 100%. Saat ini: ' + totalPct + '%');
        setCreating(false);
        return;
      }
    }

    const session = await createQuizSession(selectedBab, subBabsToPass, questionCount, durationMinutes, scheduledAt, percentagesEnabled ? subBabPercentages : undefined);
    if (session) {
      setActiveSession(session);
      setActiveView('manage');
      // Reset schedule form
      setScheduleEnabled(false);
      setScheduleDate('');
      setScheduleTime('');
    } else {
      alert("Failed to create session.");
    }
    setCreating(false);
  };

  const resolveCurrentLabel = (player: Player) => {
    if (!activeSession || activeSession.status === 'waiting') return '-';

    const total = activeSession.question_count || 0;
    const answered = playerProgress[player.id] || 0;

    if (total === 0) return '-';
    if (activeSession.status === 'finished' || player.finished_at || answered >= total) return 'Selesai';

    const current = Math.min(answered + 1, total);
    return `#${current}`;
  };

  const handleRefresh = () => {
    if (activeSession) {
      fetchQuizPlayers(activeSession.id).then(setPlayers);
      fetchQuestionsByIds(activeSession.question_ids || []).then(setSessionQuestions);
      return;
    }

    if (activeView === 'history') {
      fetchQuizHistory().then(setHistory);
      return;
    }

    if (activeView === 'manage') {
      fetchActiveSessions().then(setActiveSessions);
    }
  };

  const handleStatusChange = async (status: KuisStatus) => {
    if (!activeSession) return;
    const ok = await updateQuizStatus(activeSession.id, status);
    if (ok) {
      setActiveSession({ ...activeSession, status });
    } else {
      console.error("Failed to update status for session:", activeSession.id);
      alert("Gagal memperbarui status kuis. Pastikan tabel kuis_logs sudah memiliki kolom 'expires_at' dan 'paused_at' di Supabase.");
    }
  };

  const handleSaveSchedule = async () => {
    if (!activeSession) return;
    if (!editScheduleDate || !editScheduleTime) {
      alert('Pilih tanggal dan waktu schedule.');
      return;
    }
    const target = new Date(`${editScheduleDate}T${editScheduleTime}:00`);
    if (target.getTime() <= Date.now()) {
      alert('Waktu schedule tidak boleh di masa lalu.');
      return;
    }
    const scheduledAt = target.toISOString();
    const ok = await updateQuizSchedule(activeSession.id, scheduledAt);
    if (ok) {
      setActiveSession({ ...activeSession, scheduled_at: scheduledAt });
      setEditingSchedule(false);
    } else {
      alert('Gagal menyimpan schedule.');
    }
  };

  const handleRemoveSchedule = async () => {
    if (!activeSession) return;
    const ok = await updateQuizSchedule(activeSession.id, null);
    if (ok) {
      setActiveSession({ ...activeSession, scheduled_at: undefined });
      setEditingSchedule(false);
    } else {
      alert('Gagal menghapus schedule.');
    }
  };

  // Auto-start polling for scheduled quizzes
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'waiting' || !activeSession.scheduled_at) {
      setScheduleCountdown(null);
      return;
    }

    const targetTime = new Date(activeSession.scheduled_at).getTime();

    const tick = async () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setScheduleCountdown('Memulai...');

        // Check actual player count before starting
        const { count } = await supabase.from('player').select('*', { count: 'exact', head: true }).eq('kuis_id', activeSession.id);
        if (count === 0) {
          await deleteQuizSession(activeSession.id);
          setActiveSession(null);
          setActiveView('manage');
          return;
        }

        const ok = await updateQuizStatus(activeSession.id, 'active');
        if (ok) {
          setActiveSession({ ...activeSession, status: 'active', started_at: new Date().toISOString() });
        }
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setScheduleCountdown(
        hours > 0 ? `${hours}j ${minutes}m ${seconds}d` : `${minutes}m ${seconds}d`
      );
    };

    void tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status, activeSession?.scheduled_at]);

  // Also poll active sessions list for any scheduled quiz that should auto-start
  useEffect(() => {
    if (activeView !== 'manage' || activeSession) return;

    const checkScheduled = async () => {
      const sessions = await fetchActiveSessions();
      setActiveSessions(sessions);
      const now = Date.now();
      for (const s of sessions) {
        if (s.status === 'waiting' && s.scheduled_at && new Date(s.scheduled_at).getTime() <= now) {
          if (s.player_count === 0) {
            await deleteQuizSession(s.id);
          } else {
            await updateQuizStatus(s.id, 'active');
          }
        }
      }
    };

    void checkScheduled();
    const interval = setInterval(checkScheduled, 10000); // every 10s
    return () => clearInterval(interval);
  }, [activeView, activeSession]);

  // Tick current time for active sessions
  useEffect(() => {
    if (activeSession?.status !== 'active') return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession?.status]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-700">Quiz Management</h2>
          <div className="flex gap-2">
            {(activeView !== 'create' || activeSession) && (
              <button
                onClick={handleRefresh}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-white border-2 border-[#34C759]/20 text-[#34C759] rounded-xl font-semibold text-xs sm:text-sm hover:bg-[#34C759]/5 transition-colors"
              >
                ↻ Refresh
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setActiveSession(null);
                setActiveView('create');
              }}
              style={activeView === 'create' ? { background: '#4A90D9' } : {}}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all flex items-center gap-2 ${activeView === 'create'
                ? 'text-white border-transparent shadow-md shadow-blue-200'
                : 'bg-white border-slate-200 text-slate-500 hover:border-[#4A90D9] hover:text-[#4A90D9]'
                }`}
            >
              ✨ Create
            </button>
            <button
              onClick={() => { setActiveSession(null); setActiveView('manage'); }}
              style={activeView === 'manage' ? { background: '#34C759' } : {}}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all flex items-center gap-2 ${activeView === 'manage'
                ? 'text-white border-transparent shadow-md shadow-green-200'
                : 'bg-white border-slate-200 text-slate-500 hover:border-[#34C759] hover:text-[#34C759]'
                }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Active Sessions
            </button>
            <button
              onClick={() => {
                setActiveSession(null);
                setActiveView('history');
              }}
              style={activeView === 'history' ? { background: '#64748B' } : {}}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all flex items-center gap-2 ${activeView === 'history'
                ? 'text-white border-transparent shadow-md shadow-slate-200'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-600'
                }`}
            >
              📜 History
            </button>
          </div>
        </div>
      </div>

      {activeView === 'create' && !activeSession && (
        <div className="max-w-2xl mx-auto py-4 md:py-6">
          {/* Header Card */}
          <div className="bg-white rounded-[24px] p-5 mb-4 border border-nike-grey-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-[18px] bg-[#F0F7FF] flex items-center justify-center shadow-inner">
                <span className="text-2xl animate-bounce">🎯</span>
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-black text-nike-black uppercase tracking-tight">Buat Kuis Baru</h3>
                <p className="text-[11px] font-medium text-nike-grey-400 uppercase tracking-[0.2em] mt-1">Konfigurasikan sesi kuis Live</p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.05)] border border-nike-grey-100 overflow-hidden">
            {/* BAB & Sub-bab */}
            <div className="p-5 pb-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF5F5] flex items-center justify-center border border-[#FED7D7]">
                    <span className="text-base">📚</span>
                  </div>
                  <label className="text-[11px] font-black text-nike-black uppercase tracking-[0.2em]">BAB</label>
                </div>
                <div className="relative">
                  <select
                    value={selectedBab}
                    onChange={(e) => {
                      setSelectedBab(e.target.value);
                      setSelectedSubBabs([]);
                      setSubBabPercentages({});
                    }}
                    className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[16px] px-4 h-[48px] text-[13px] font-bold text-nike-black focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all appearance-none cursor-pointer uppercase"
                  >
                    <option value="Semua BAB">✨ Semua BAB</option>
                    {babs.length > 0 ? (
                      babs.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)
                    ) : (
                      <option disabled>Loading BAB...</option>
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-nike-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF5F5] flex items-center justify-center border border-[#FED7D7]">
                    <span className="text-base">📖</span>
                  </div>
                  <label className="text-[11px] font-black text-nike-black uppercase tracking-[0.2em]">Sub-bab</label>
                </div>
                <div className="relative">
                  <div
                    onClick={() => setIsSubBabOpen(!isSubBabOpen)}
                    className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[16px] px-4 min-h-[48px] py-2 flex items-center justify-between cursor-pointer focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedSubBabs.length === 0 ? (
                        <span className="text-[13px] font-bold text-nike-black uppercase">✨ Semua Sub-bab</span>
                      ) : (
                        selectedSubBabs.map(v => {
                          const label = displaySubBabs.find(d => d.value === v)?.label || v;
                          return (
                            <span key={v} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-bold uppercase flex items-center gap-1">
                              {label}
                              <button onClick={(e) => {
                                e.stopPropagation();
                                const next = selectedSubBabs.filter(s => s !== v);
                                setSelectedSubBabs(next);
                                const newPct = { ...subBabPercentages };
                                delete newPct[v];
                                setSubBabPercentages(newPct);
                              }} className="hover:text-indigo-900">&times;</button>
                            </span>
                          );
                        })
                      )}
                    </div>
                    <svg className={`w-4 h-4 text-nike-grey-400 transition-transform ${isSubBabOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isSubBabOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
                      <div
                        className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          setSelectedSubBabs([]);
                          setSubBabPercentages({});
                          setIsSubBabOpen(false);
                        }}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedSubBabs.length === 0 ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
                          {selectedSubBabs.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className="text-[12px] font-bold text-gray-700 uppercase">✨ Semua Sub-bab</span>
                      </div>

                      {loadingSubBabs ? (
                        <div className="p-3 text-center text-[12px] text-gray-500">Loading...</div>
                      ) : (
                        displaySubBabs.map(sb => {
                          const isSelected = selectedSubBabs.includes(sb.value);
                          return (
                            <div
                              key={sb.value}
                              className="p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                let next: string[];
                                if (isSelected) {
                                  next = selectedSubBabs.filter(v => v !== sb.value);
                                } else {
                                  next = [...selectedSubBabs, sb.value];
                                }
                                setSelectedSubBabs(next);

                                if (percentagesEnabled) {
                                  const newPct = { ...subBabPercentages };
                                  if (!isSelected) newPct[sb.value] = 0;
                                  else delete newPct[sb.value];

                                  const total = next.length;
                                  if (total > 0) {
                                    const equal = Math.floor(100 / total);
                                    let rem = 100 - (equal * total);
                                    next.forEach(v => {
                                      newPct[v] = equal + (rem > 0 ? 1 : 0);
                                      rem--;
                                    });
                                  }
                                  setSubBabPercentages(newPct);
                                }
                              }}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
                                {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span className="text-[12px] font-bold text-gray-700 uppercase">{sb.label}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Question Count */}
            <div className="p-5 py-4 bg-[#FAFBFF]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#F0FFF4] flex items-center justify-center border border-[#C6F6D5]">
                  <span className="text-base">✏️</span>
                </div>
                <label className="text-[11px] font-black text-nike-black uppercase tracking-[0.2em]">Jumlah Soal</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 20, 25, 30, 40].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 h-[44px] rounded-[16px] text-[13px] font-black transition-all border-2 ${questionCount === n
                        ? 'bg-[#4A90D9] border-transparent text-white shadow-lg shadow-[#4A90D9]/20'
                        : 'bg-white border-[#E2E8F0] text-nike-grey-500 hover:border-[#4A90D9] hover:text-[#4A90D9]'
                      }`}
                  >
                    {n} SOAL
                  </button>
                ))}
              </div>
            </div>

            {/* Persentase Soal */}
            {(() => {
              const effectiveSubBabs = selectedSubBabs.length > 0 ? selectedSubBabs : displaySubBabs.map(sb => sb.value);
              if (effectiveSubBabs.length === 0) return null;

              return (
                <div className="p-5 py-4 bg-white border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#FFF0F6] flex items-center justify-center border border-[#FED7E2]">
                        <span className="text-base">📊</span>
                      </div>
                      <label className="text-[11px] font-black text-nike-black uppercase tracking-[0.2em]">Persentase Soal</label>
                    </div>
                    <button
                      onClick={() => {
                        const newState = !percentagesEnabled;
                        setPercentagesEnabled(newState);
                        if (newState) {
                          const newPct = { ...subBabPercentages };
                          const total = effectiveSubBabs.length;
                          if (total > 0) {
                            const equal = Math.floor(100 / total);
                            let rem = 100 - (equal * total);
                            effectiveSubBabs.forEach(v => {
                              newPct[v] = equal + (rem > 0 ? 1 : 0);
                              rem--;
                            });
                          }
                          setSubBabPercentages(newPct);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#4A90D9] focus:ring-offset-2 ${percentagesEnabled ? 'bg-[#4A90D9]' : 'bg-gray-200'
                        }`}
                      role="switch"
                      aria-checked={percentagesEnabled}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${percentagesEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                  {percentagesEnabled && (
                    <div className="space-y-3 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      {effectiveSubBabs.map(sub => {
                        const label = displaySubBabs.find(d => d.value === sub)?.label || sub;
                        return (
                          <div key={sub} className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold text-gray-700 uppercase flex-1 truncate">{label}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={subBabPercentages[sub] || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setSubBabPercentages(prev => ({ ...prev, [sub]: val }));
                                }}
                                className="w-16 h-8 text-center text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#4A90D9]"
                              />
                              <span className="text-xs font-bold text-gray-500">%</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-xs font-black text-gray-500 uppercase">Total:</span>
                        <span className={`text-xs font-black uppercase ${effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0) === 100 ? 'text-green-500' : 'text-red-500'
                          }`}>
                          {effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Duration */}
            <div className="p-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#EBF8FF] flex items-center justify-center border border-[#BEE3F8]">
                  <span className="text-base">⏱️</span>
                </div>
                <label className="text-[11px] font-black text-nike-black uppercase tracking-[0.2em]">Durasi Waktu</label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[30, 60, 90, 120].map(m => (
                  <button
                    key={m}
                    onClick={() => setDurationMinutes(m)}
                    className={`h-[44px] rounded-[16px] text-[13px] font-black transition-all border-2 ${durationMinutes === m
                        ? 'bg-[#34C759] border-transparent text-white shadow-lg shadow-[#34C759]/20'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-nike-grey-500 hover:border-[#34C759] hover:text-[#34C759]'
                      }`}
                  >
                    {m} MIN
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="p-5 py-4 bg-[#FAFBFF]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF8E1] flex items-center justify-center border border-[#FFE082]">
                    <span className="text-base">📅</span>
                  </div>
                  <label className="text-[11px] font-black text-nike-black uppercase tracking-[0.2em]">Schedule Quiz</label>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${scheduleEnabled ? 'bg-[#4A90D9]' : 'bg-gray-300'
                    }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${scheduleEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
              </div>
              {scheduleEnabled && (
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tanggal</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => {
                        setScheduleDate(e.target.value);
                        // Clear time if it's now in the past
                        if (e.target.value === new Date().toISOString().split('T')[0] && scheduleTime < new Date().toTimeString().slice(0, 5)) {
                          setScheduleTime('');
                        }
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      max={new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]}
                      className="w-full bg-white border-2 border-[#E2E8F0] rounded-[12px] px-4 h-[44px] text-[13px] font-bold text-nike-black focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Waktu</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      min={scheduleDate === new Date().toISOString().split('T')[0] ? new Date().toTimeString().slice(0, 5) : undefined}
                      className="w-full bg-white border-2 border-[#E2E8F0] rounded-[12px] px-4 h-[44px] text-[13px] font-bold text-nike-black focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                    />
                  </div>
                </div>
              )}
              {scheduleEnabled && scheduleDate && scheduleTime && (
                <p className="text-[11px] font-semibold text-[#4A90D9] mt-2 flex items-center gap-1">
                  ⏰ Kuis akan dimulai otomatis pada {new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="p-5 bg-[#F8FAFC]">
              <button
                onClick={handleCreate}
                disabled={creating || displaySubBabs.length === 0}
                className={`w-full h-[54px] rounded-[18px] text-white font-black text-[14px] tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] disabled:opacity-80 ${creating || displaySubBabs.length === 0 ? 'bg-slate-300' : 'bg-nike-black hover:bg-nike-grey-500 shadow-nike-black/10'
                  }`}
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    CREATING...
                  </span>
                ) : displaySubBabs.length === 0 ? (
                  <span className="flex items-center justify-center gap-3">
                    <span>❌</span> TIDAK ADA SUB-BAB TERSEDIA
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <span>🚀</span> BUAT SESI KUIS
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSession ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveSession(null)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900">Session Details</h2>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Join Code</p>
              <h1 className="text-4xl md:text-5xl font-black text-indigo-700 tracking-widest font-mono">{activeSession.quiz_code}</h1>
              <p className="mt-2 text-sm text-gray-600 font-medium capitalize">Topik: {activeSession.bab?.replace(/_/g, ' ')}, {activeSession.sub_bab?.replace(/_/g, ' ')} <span className="mx-2">•</span> {activeSession.question_count} Questions</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${activeSession.status === 'active' ? 'bg-green-100 text-green-700' :
                  activeSession.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                    activeSession.status === 'paused' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                }`}>
                {activeSession.status}
              </span>
              <div className="flex flex-row items-center gap-4 flex-wrap justify-end">
                {activeSession.status === 'waiting' && (
                  <div className="relative flex items-center">
                    {activeSession.scheduled_at && !editingSchedule ? (
                      <div className="flex items-center gap-3 bg-[#F0F7FF] border border-[#BFDBFE] px-4 py-2 rounded-full">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Mulai otomatis dalam</span>
                          <span className="text-sm font-black text-[#4A90D9] font-mono tabular-nums">{scheduleCountdown || '...'}</span>
                        </div>
                        <div className="w-px h-6 bg-[#BFDBFE]"></div>
                        <button
                          onClick={() => {
                            setEditingSchedule(true);
                            const d = new Date(activeSession.scheduled_at!);
                            setEditScheduleDate(d.toISOString().split('T')[0]);
                            setEditScheduleTime(d.toTimeString().slice(0, 5));
                          }}
                          className="text-xs font-bold text-[#4A90D9] hover:text-blue-700 uppercase tracking-wider"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    ) : !editingSchedule && (
                      <button
                        onClick={() => {
                          setEditingSchedule(true);
                          setEditScheduleDate('');
                          setEditScheduleTime('');
                        }}
                        className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold text-gray-500 hover:text-gray-700 uppercase tracking-wider transition-colors"
                      >
                        <span className="text-sm">📅</span> Set Schedule
                      </button>
                    )}

                    {editingSchedule && (
                      <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold uppercase text-gray-700">Set Schedule</h4>
                          <button onClick={() => setEditingSchedule(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Tanggal</label>
                              <input
                                type="date"
                                value={editScheduleDate}
                                onChange={(e) => {
                                  setEditScheduleDate(e.target.value);
                                  if (e.target.value === new Date().toISOString().split('T')[0] && editScheduleTime < new Date().toTimeString().slice(0, 5)) {
                                    setEditScheduleTime('');
                                  }
                                }}
                                min={new Date().toISOString().split('T')[0]}
                                max={new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]}
                                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 h-9 text-xs font-bold text-gray-700 focus:outline-none focus:border-[#4A90D9]"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Waktu</label>
                              <input
                                type="time"
                                value={editScheduleTime}
                                onChange={(e) => setEditScheduleTime(e.target.value)}
                                min={editScheduleDate === new Date().toISOString().split('T')[0] ? new Date().toTimeString().slice(0, 5) : undefined}
                                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 h-9 text-xs font-bold text-gray-700 focus:outline-none focus:border-[#4A90D9]"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button onClick={handleSaveSchedule} className="flex-1 bg-[#4A90D9] text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-blue-600">Simpan</button>
                            {activeSession.scheduled_at && (
                              <button onClick={handleRemoveSchedule} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-red-600">Hapus</button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {(activeSession.status === 'active' || activeSession.status === 'paused') && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sisa Waktu</span>
                      <span className={`text-lg font-black tracking-tight ${activeSession.status === 'paused' ? 'text-orange-500' : 'text-indigo-600'}`}>
                        {(() => {
                          if (!activeSession.expires_at) return '-';
                          const referenceTime = (activeSession.status === 'paused' && activeSession.paused_at) ? new Date(activeSession.paused_at).getTime() : currentTime;
                          const diff = new Date(activeSession.expires_at).getTime() - referenceTime;
                          if (diff <= 0) return '00:00:00';
                          const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
                          const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                          const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                          return `${h}:${m}:${s}`;
                        })()}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {activeSession.status === 'waiting' && (
                      <>
                        <button
                          onClick={() => handleStatusChange('active')}
                          disabled={players.length === 0}
                          className={`bg-nike-green text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-colors shadow-sm ${players.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}`}
                        >
                          Start Quiz
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          className="bg-white border-2 border-red-500 text-red-500 px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-red-50 transition-colors shadow-sm"
                        >
                          Cancel Quiz
                        </button>
                      </>
                    )}
                    {(activeSession.status === 'active' || activeSession.status === 'paused') && (
                      <>
                        <button
                          onClick={() => handleStatusChange(activeSession.status === 'active' ? 'paused' : 'active')}
                          className={`${activeSession.status === 'active' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-nike-green hover:bg-green-600'} text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-colors shadow-sm`}
                        >
                          {activeSession.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                        <button onClick={() => setShowEndConfirm(true)} className="bg-nike-red text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-red-600 transition-colors shadow-sm">End Quiz</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* View Questions Button */}
            <div className="px-5 sm:px-6 pb-5">
              <button
                onClick={async () => {
                  setShowViewQuestions(true);
                  setLoadingAllAnswers(true);
                  // Fetch answers from all players
                  const allAnswers: KuisResult[] = [];
                  for (const p of players) {
                    const ans = await fetchPlayerAnswers(p.id);
                    allAnswers.push(...ans);
                  }
                  setAllPlayerAnswers(allAnswers);
                  setLoadingAllAnswers(false);
                }}
                className="w-full py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 rounded-2xl text-sm font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
              >
                <span>📋</span> View Questions
              </button>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Players ({players.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time (s)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Waiting for players to join...</td></tr>
                  ) : players.slice((playersPage - 1) * itemsPerPage, playersPage * itemsPerPage).map((p, i) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">{((playersPage - 1) * itemsPerPage) + i + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className="block max-w-[200px] truncate" title={p.name}>{p.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="font-semibold" title={`Soal saat ini: ${resolveCurrentLabel(p)}`}>{resolveCurrentLabel(p)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{p.score} / {activeSession.question_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.total_time}s</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setViewingPlayer(p)}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded"
                        >
                          View Answers
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {players.length > itemsPerPage && (
              <Pagination
                totalItems={players.length}
                itemsPerPage={itemsPerPage}
                currentPage={playersPage}
                onPageChange={setPlayersPage}
              />
            )}
          </div>
        </div>
      ) : (
        <>
          {activeView === 'manage' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires In</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No active sessions found.</td>
                      </tr>
                    ) : activeSessions.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage).map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700 font-mono">
                          <span className="block max-w-[140px] truncate" title={s.quiz_code}>{s.quiz_code}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${s.status === 'active' ? 'bg-green-100 text-green-700' : s.status === 'paused' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
                          {s.status === 'waiting' && s.scheduled_at && (
                            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600" title={new Date(s.scheduled_at).toLocaleString('id-ID')}>
                              📅 {new Date(s.scheduled_at).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">{s.player_count || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.question_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.duration_minutes} min</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {s.expires_at ? (
                            <span className={`${s.status === 'active' || s.status === 'paused' ? 'text-indigo-600' : 'text-red-500'} font-bold`}>
                              {(() => {
                                const referenceTime = (s.status === 'paused' && s.paused_at) ? new Date(s.paused_at).getTime() : Date.now();
                                const diff = new Date(s.expires_at).getTime() - referenceTime;
                                if (diff <= 0) return 'Expired';
                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                              })()}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => setActiveSession(s)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded">View Detail</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activeSessions.length > itemsPerPage && (
                <Pagination
                  totalItems={activeSessions.length}
                  itemsPerPage={itemsPerPage}
                  currentPage={activePage}
                  onPageChange={setActivePage}
                />
              )}
            </div>
          )}

          {activeView === 'history' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topik</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No history found.</td>
                      </tr>
                    ) : history.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage).map(h => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          <span className="block max-w-[140px] truncate" title={h.quiz_code}>{h.quiz_code}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          <span
                            className="block max-w-[220px] truncate"
                            title={`${h.bab?.replace(/_/g, ' ')}, ${h.sub_bab?.replace(/_/g, ' ')}`}
                          >
                            {h.bab?.replace(/_/g, ' ')}, {h.sub_bab?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{h.player_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-nike-black">
                          <span className="block max-w-[180px] truncate" title={h.winner}>{h.winner}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-nike-green">{h.top_score} / {h.question_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-gray-100 text-gray-700">{h.status}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => setActiveSession(h)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded">View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history.length > historyPerPage && (
                <Pagination
                  totalItems={history.length}
                  itemsPerPage={historyPerPage}
                  currentPage={historyPage}
                  onPageChange={setHistoryPage}
                />
              )}
            </div>
          )}
        </>
      )}
      {/* Player Answers Modal */}
      {viewingPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[10000]" onClick={() => setViewingPlayer(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl">
                  {viewingPlayer.name[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Player Performance</h2>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                    {viewingPlayer.name} • {activeSession?.bab?.replace(/_/g, ' ')}, {activeSession?.sub_bab?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingPlayer(null)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all">×</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="grid grid-cols-3 gap-6 mb-10 pb-10 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Score</p>
                  <p className="text-2xl font-black text-indigo-600">{viewingPlayer.score} / {activeSession?.question_count}</p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Time Spent</p>
                  <p className="text-2xl font-black text-gray-900">{viewingPlayer.total_time}s</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Status</p>
                  <p className={`text-sm font-black uppercase ${viewingPlayer.finished_at ? 'text-green-600' : 'text-orange-500 animate-pulse'}`}>
                    {viewingPlayer.finished_at ? 'FINISHED' : 'PLAYING'}
                  </p>
                </div>
              </div>

              {loadingAnswers ? (
                <div className="text-center py-20 text-gray-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading answers...</div>
              ) : (
                <div className="space-y-8">
                  {(() => {
                    const answeredIds = playerAnswers.map(a => a.question_id);
                    const allIds = viewingPlayer.question_ids || activeSession?.question_ids || [];
                    const orderedIds = [
                      ...answeredIds,
                      ...allIds.filter(id => !answeredIds.includes(id))
                    ];

                    return orderedIds.map((qId, idx) => {
                      const question = sessionQuestions.find(q => q.id === qId);
                      const answer = playerAnswers.find(a => a.question_id === qId);

                      if (!question) return null;

                      const correctOptionText = (question as any)[`option_${question.correct_answer.toLowerCase()}`];

                      return (
                        <div key={qId} className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-white/50">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Question {idx + 1}</span>
                            {answer ? (
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${answer.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {answer.is_correct ? 'Correct' : 'Incorrect'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-gray-100 text-gray-400">Not Answered Yet</span>
                            )}
                          </div>
                          <div className="p-6 space-y-4">
                            <RichContent html={question.question_text} className="text-[16px] font-bold text-gray-900 leading-tight" />

                            {answer && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className={`p-4 rounded-xl border-2 ${answer.is_correct ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}>
                                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">User Answer</p>
                                  <RichContent html={answer.user_answer} className={`text-sm font-medium ${answer.is_correct ? 'text-green-800' : 'text-red-800'}`} />
                                  <p className="text-[9px] text-gray-400 mt-2">Time taken: {answer.time_taken}s</p>
                                </div>

                                {!answer.is_correct && (
                                  <div className="p-4 rounded-xl border-2 border-green-100 bg-green-50/20">
                                    <p className="text-[10px] font-black text-green-600 uppercase mb-2">Correct Answer ({question.correct_answer})</p>
                                    <RichContent html={correctOptionText} className="text-sm font-medium text-green-800" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setViewingPlayer(null)} className="px-10 h-12 rounded-full bg-nike-black text-white font-black uppercase text-[10px] tracking-widest hover:bg-nike-grey-500 transition-all shadow-lg shadow-nike-black/20">Close Breakdown</button>
            </div>
          </div>
        </div>
      )}

      {/* View Questions Modal */}
      {showViewQuestions && activeSession && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[10000]" onClick={() => setShowViewQuestions(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Question Analytics</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {activeSession.question_count} Soal • {players.length} Pemain
                </p>
              </div>
              <button onClick={() => setShowViewQuestions(false)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all">✕</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white">
              {loadingAllAnswers ? (
                <div className="text-center py-20 text-gray-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading question data...</div>
              ) : (
                <div className="space-y-6">
                  {(activeSession.question_ids || []).map((qId, idx) => {
                    const question = sessionQuestions.find(q => q.id === qId);
                    if (!question) return null;

                    const correctLabel = question.correct_answer;
                    const correctOptionText = (question as any)[`option_${correctLabel.toLowerCase()}`];
                    const correctAnswers = allPlayerAnswers.filter(a => a.question_id === qId && a.is_correct);
                    const totalAnswers = allPlayerAnswers.filter(a => a.question_id === qId);
                    const correctPlayerNames = correctAnswers.map(a => {
                      const player = players.find(p => p.id === a.player_id);
                      return player?.name || 'Unknown';
                    });

                    return (
                      <div key={qId} className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-white/50">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Soal {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${correctAnswers.length === 0 ? 'bg-red-100 text-red-600' : correctAnswers.length === totalAnswers.length ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {correctAnswers.length}/{totalAnswers.length} Benar
                            </span>
                          </div>
                        </div>
                        <div className="p-5 space-y-4">
                          <RichContent html={question.question_text} className="text-[15px] font-bold text-gray-900 leading-relaxed" />

                          {/* Correct Answer */}
                          <div className="p-4 rounded-xl border-2 border-green-100 bg-green-50/30">
                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Jawaban Benar ({correctLabel})</p>
                            <RichContent html={correctOptionText} className="text-sm font-medium text-green-800" />
                          </div>

                          {/* Who answered correctly */}
                          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">
                              Pemain yang Benar ({correctAnswers.length})
                            </p>
                            {correctPlayerNames.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Belum ada yang menjawab benar</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {correctPlayerNames.map((name, i) => (
                                  <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setShowViewQuestions(false)} className="px-10 h-12 rounded-full bg-nike-black text-white font-black uppercase text-[10px] tracking-widest hover:bg-nike-grey-500 transition-all shadow-lg shadow-nike-black/20">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* End Quiz Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]" onClick={() => setShowEndConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Akhiri Quiz?</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">Apakah anda yakin menyelesaikan quiz sekarang?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Tidak
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  handleStatusChange('finished');
                }}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
              >
                Ya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Quiz Confirmation Modal */}
      {showCancelConfirm && activeSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🗑️
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Batalkan Quiz?</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">Apakah anda yakin ingin membatalkan kuis ini? Semua data pemain dan jawaban akan dihapus secara permanen.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Tidak
              </button>
              <button
                onClick={async () => {
                  setShowCancelConfirm(false);
                  const ok = await deleteQuizSession(activeSession.id);
                  if (ok) {
                    setActiveSession(null);
                    setActiveView('manage');
                  } else {
                    alert('Gagal membatalkan kuis.');
                  }
                }}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({ totalItems, itemsPerPage, currentPage, onPageChange }: { totalItems: number, itemsPerPage: number, currentPage: number, onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => onPageChange(i + 1)}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === i + 1
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
