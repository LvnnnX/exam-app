"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { createQuizSession, updateQuizStatus, updateQuizSchedule, fetchQuizPlayers, fetchQuizHistory, fetchActiveSessions, fetchPlayerAnswers, deleteQuizSession, fetchPlayerQuestionIds, formatHMS, type KuisLog, type Player, type KuisStatus, type KuisResult } from '@/lib/quiz';
import { fetchQuestionsByIds, fetchSubBabsAdmin, type RawQuestion, type SubBabInfo } from '@/lib/questions';
import { formatCategorySelectionLabel } from '@/lib/categories';
import RichContent from '@/app/components/RichContent';
import MultiSelectDropdown from '@/app/components/MultiSelectDropdown';
import LeaderboardViewModal from '@/app/components/LeaderboardViewModal';

export default function AdminQuizTab({ mapels, babs, subBabs }: { mapels: string[], babs: string[], subBabs: { label: string, value: string }[] }) {
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
  const [selectedMapels, setSelectedMapels] = useState<string[]>([]);
  const [selectedBabs, setSelectedBabs] = useState<string[]>([]);
  const [selectedSubBabs, setSelectedSubBabs] = useState<string[]>([]);
  const [percentagesEnabled, setPercentagesEnabled] = useState(false);
  const [subBabPercentages, setSubBabPercentages] = useState<Record<string, number>>({});
  const [isMapelOpen, setIsMapelOpen] = useState(false);
  const [isBabOpen, setIsBabOpen] = useState(false);
  const [isSubBabOpen, setIsSubBabOpen] = useState(false);
  const [displayBabs, setDisplayBabs] = useState<string[]>(babs);
  const [displaySubBabs, setDisplaySubBabs] = useState<SubBabInfo[]>(subBabs);
  const [loadingBabs, setLoadingBabs] = useState(false);
  const [loadingSubBabs, setLoadingSubBabs] = useState(false);

  // Sync props initially or when they change
  useEffect(() => {
    if (selectedMapels.length === 0) {
      setDisplayBabs(babs);
    }
    if (selectedBabs.length === 0) {
      setDisplaySubBabs(subBabs);
    }
  }, [babs, subBabs, selectedMapels, selectedBabs]);

  // Dynamic bab loading based on selectedMapels
  useEffect(() => {
    const loadBabs = async () => {
      if (selectedMapels.length === 0) {
        setDisplayBabs(babs);
        return;
      }

      setLoadingBabs(true);
      try {
        const { fetchBabsAdmin } = await import('@/lib/questions');
        const filtered = await fetchBabsAdmin(selectedMapels);
        setDisplayBabs(filtered.map(f => f.value));
      } finally {
        setLoadingBabs(false);
      }
    };
    void loadBabs();
  }, [selectedMapels, babs]);

  // Dynamic sub-bab loading based on selectedBabs
  useEffect(() => {
    const loadFiltered = async () => {
      if (selectedBabs.length === 0) {
        setDisplaySubBabs(subBabs);
        return;
      }

      setLoadingSubBabs(true);
      try {
        const filtered = await fetchSubBabsAdmin(selectedBabs);
        setDisplaySubBabs(filtered);
      } finally {
        setLoadingSubBabs(false);
      }
    };

    void loadFiltered();
  }, [selectedBabs, subBabs]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [creating, setCreating] = useState(false);
  const [quizMode, setQuizMode] = useState<'strict' | 'standard'>('strict');
  const [allowJoinMidGame, setAllowJoinMidGame] = useState(true);
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
  const [historyFilterMapels, setHistoryFilterMapels] = useState<string[]>([]);
  const [historyFilterBabs, setHistoryFilterBabs] = useState<string[]>([]);
  const [historyFilterSubBabs, setHistoryFilterSubBabs] = useState<string[]>([]);

  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [playersPage, setPlayersPage] = useState(1);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showViewQuestions, setShowViewQuestions] = useState(false);
  const [showLeaderboardView, setShowLeaderboardView] = useState(false);
  const [allPlayerAnswers, setAllPlayerAnswers] = useState<KuisResult[]>([]);
  const [loadingAllAnswers, setLoadingAllAnswers] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0); // server - local offset in ms
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
            { event: '*', schema: 'public', table: 'player' },
            (payload) => {
              // Re-fetch players for this session on any player update (handles UPDATEs missing kuis_id)
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
    updateQuizStatus(activeSession.id, 'finished').then((result) => {
      if (!result) {
        autoFinishRef.current = false;
      } else {
        setActiveSession(result);
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
          updateQuizStatus(activeSession.id, 'finished').then((result) => {
            if (result) setActiveSession(result);
          });
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
      // Fetch player's specific question_ids if we don't have them yet
      if (!viewingPlayer.question_ids || viewingPlayer.question_ids.length === 0) {
        fetchPlayerQuestionIds(viewingPlayer.id).then(qIds => {
          if (qIds && qIds.length > 0) {
            setViewingPlayer(prev => prev && prev.id === viewingPlayer.id ? { ...prev, question_ids: qIds } : prev);
          }
        });
      }

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

    const session = await createQuizSession(
      selectedMapels.length === 0 ? 'Semua MAPEL' : selectedMapels,
      selectedBabs.length === 0 ? 'Semua BAB' : selectedBabs,
      subBabsToPass,
      questionCount,
      durationMinutes,
      scheduledAt,
      percentagesEnabled ? subBabPercentages : undefined,
      quizMode,
      allowJoinMidGame
    );
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
    const result = await updateQuizStatus(activeSession.id, status);
    if (result) {
      setActiveSession(result);
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
        const { count } = await supabase.from('public_players').select('*', { count: 'exact', head: true }).eq('kuis_id', activeSession.id);
        if (count === 0) {
          await deleteQuizSession(activeSession.id);
          setActiveSession(null);
          setActiveView('manage');
          return;
        }

        const result = await updateQuizStatus(activeSession.id, 'active');
        if (result) {
          setActiveSession(result);
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

  // Tick current time for active sessions (also during paused to handle re-mounts)
  useEffect(() => {
    if (activeSession?.status !== 'active' && activeSession?.status !== 'paused') return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession?.status]);

  // Sync with server time every 30 seconds to prevent clock drift
  useEffect(() => {
    if (activeSession?.status !== 'active') return;

    const syncServerTime = async () => {
      try {
        const before = Date.now();
        const { data } = await supabase.rpc('get_server_time');
        const after = Date.now();
        if (data) {
          const serverNow = new Date(data).getTime();
          const localNow = before + (after - before) / 2; // estimate midpoint
          setServerTimeOffset(serverNow - localNow);
        }
      } catch {
        // Silently ignore sync failures — use local time as fallback
      }
    };

    syncServerTime(); // initial sync
    const interval = setInterval(syncServerTime, 30000); // every 30s
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
        <div className="max-w-2xl mx-auto px-3 md:px-0 py-4 md:py-6">
          {/* Header Card */}
          <div className="bg-white rounded-[20px] p-3 md:p-4 mb-3 border border-nike-grey-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-[14px] bg-[#F0F7FF] flex items-center justify-center shadow-inner">
                <span className="text-xl animate-bounce">🎯</span>
              </div>
              <div>
                <h3 className="text-md md:text-lg font-black text-nike-black uppercase tracking-tight leading-tight">Buat Kuis Baru</h3>
                <p className="text-[10px] font-medium text-nike-grey-400 uppercase tracking-[0.2em] mt-0.5">Sesi kuis Live</p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-[20px] shadow-[0_16px_40px_rgba(0,0,0,0.05)] border border-nike-grey-100 overflow-hidden">
            {/* MAPEL & BAB & Sub-bab */}
            <div className="p-3 md:p-4 pb-3 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-[#F0F7FF] flex items-center justify-center border border-[#BEE3F8]">
                    <span className="text-sm">📌</span>
                  </div>
                  <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">MAPEL</label>
                </div>
                <div className="relative">
                  <div
                    onClick={() => setIsMapelOpen(!isMapelOpen)}
                    className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[12px] px-3 min-h-[38px] md:min-h-[42px] py-1.5 flex items-center justify-between cursor-pointer focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedMapels.length === 0 ? (
                        <span className="text-[12px] font-bold text-nike-black uppercase">✨ Semua MAPEL</span>
                      ) : (
                        selectedMapels.map(m => (
                          <span key={m} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                            {m.replace(/_/g, ' ')}
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const next = selectedMapels.filter(v => v !== m);
                              setSelectedMapels(next);
                              setSelectedBabs([]);
                              setSelectedSubBabs([]);
                            }} className="hover:text-blue-900">&times;</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`w-3.5 h-3.5 text-nike-grey-400 transition-transform ${isMapelOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isMapelOpen && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
                      <div
                        className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          setSelectedMapels([]);
                          setSelectedBabs([]);
                          setSelectedSubBabs([]);
                          setIsMapelOpen(false);
                        }}
                      >
                        <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selectedMapels.length === 0 ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                          {selectedMapels.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className="text-[12px] font-bold text-gray-700 uppercase">✨ Semua MAPEL</span>
                      </div>
                      {mapels.map(m => {
                        const isSelected = selectedMapels.includes(m);
                        return (
                          <div
                            key={m}
                            className="p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                            onClick={() => {
                              const next = isSelected ? selectedMapels.filter(v => v !== m) : [...selectedMapels, m];
                              setSelectedMapels(next);
                              setSelectedBabs([]);
                              setSelectedSubBabs([]);
                            }}
                          >
                            <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                              {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-[12px] font-bold text-gray-700 uppercase">{m.replace(/_/g, ' ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-[#FFF5F5] flex items-center justify-center border border-[#FED7D7]">
                    <span className="text-sm">📚</span>
                  </div>
                  <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">BAB</label>
                </div>
                <div className="relative">
                  <div
                    onClick={() => setIsBabOpen(!isBabOpen)}
                    className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[12px] px-3 min-h-[38px] md:min-h-[42px] py-1.5 flex items-center justify-between cursor-pointer focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedBabs.length === 0 ? (
                        <span className="text-[12px] font-bold text-nike-black uppercase">✨ Semua BAB</span>
                      ) : (
                        selectedBabs.map(b => (
                          <span key={b} className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                            {b.replace(/_/g, ' ')}
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const next = selectedBabs.filter(v => v !== b);
                              setSelectedBabs(next);
                              setSelectedSubBabs([]);
                            }} className="hover:text-red-900">&times;</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`w-3.5 h-3.5 text-nike-grey-400 transition-transform ${isBabOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isBabOpen && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
                      <div
                        className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          setSelectedBabs([]);
                          setSelectedSubBabs([]);
                          setIsBabOpen(false);
                        }}
                      >
                        <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selectedBabs.length === 0 ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                          {selectedBabs.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className="text-[12px] font-bold text-gray-700 uppercase">✨ Semua BAB</span>
                      </div>
                      {loadingBabs ? (
                        <div className="p-3 text-center text-[12px] text-gray-500 italic">Loading BAB...</div>
                      ) : displayBabs.length > 0 ? (
                        displayBabs.map(b => {
                          const isSelected = selectedBabs.includes(b);
                          return (
                            <div
                              key={b}
                              className="p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                const next = isSelected ? selectedBabs.filter(v => v !== b) : [...selectedBabs, b];
                                setSelectedBabs(next);
                                setSelectedSubBabs([]);
                              }}
                            >
                              <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                                {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span className="text-[12px] font-bold text-gray-700 uppercase">{b.replace(/_/g, ' ')}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-[12px] text-gray-400 italic">No BAB found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-[#FFF5F5] flex items-center justify-center border border-[#FED7D7]">
                    <span className="text-sm">📖</span>
                  </div>
                  <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">Sub-bab</label>
                </div>
                <div className="relative">
                  <div
                    onClick={() => setIsSubBabOpen(!isSubBabOpen)}
                    className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[12px] px-3 min-h-[38px] md:min-h-[42px] py-1.5 flex items-center justify-between cursor-pointer focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedSubBabs.length === 0 ? (
                        <span className="text-[12px] font-bold text-nike-black uppercase">✨ Semua Sub-bab</span>
                      ) : (
                        selectedSubBabs.map(v => {
                          const label = displaySubBabs.find(d => d.value === v)?.label || v;
                          return (
                            <span key={v} className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
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
                    <svg className={`w-3.5 h-3.5 text-nike-grey-400 transition-transform ${isSubBabOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selectedSubBabs.length === 0 ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
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
                              <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
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
            <div className="p-3 md:p-4 py-3 bg-[#FAFBFF]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-[#F0FFF4] flex items-center justify-center border border-[#C6F6D5]">
                  <span className="text-sm">✏️</span>
                </div>
                <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">Jumlah Soal</label>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {[5, 10, 20, 25, 30, 40, 50, 100].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 h-[36px] md:h-[40px] rounded-[12px] text-[12px] font-black transition-all border-2 ${questionCount === n
                      ? 'bg-[#4A90D9] border-transparent text-white shadow-lg shadow-[#4A90D9]/20'
                      : 'bg-white border-[#E2E8F0] text-nike-grey-500 hover:border-[#4A90D9] hover:text-[#4A90D9]'
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Persentase Soal */}
            {(() => {
              const effectiveSubBabs = selectedSubBabs.length > 0 ? selectedSubBabs : displaySubBabs.map(sb => sb.value);
              if (effectiveSubBabs.length === 0) return null;

              return (
                <div className="p-3 md:p-4 py-3 bg-white border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#FFF0F6] flex items-center justify-center border border-[#FED7E2]">
                        <span className="text-sm">📊</span>
                      </div>
                      <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">Persentase Soal</label>
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
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#4A90D9] focus:ring-offset-2 ${percentagesEnabled ? 'bg-[#4A90D9]' : 'bg-gray-200'
                        }`}
                      role="switch"
                      aria-checked={percentagesEnabled}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${percentagesEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                  {percentagesEnabled && (
                    <div className="space-y-2.5 mt-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      {effectiveSubBabs.map(sub => {
                        const label = displaySubBabs.find(d => d.value === sub)?.label || sub;
                        return (
                          <div key={sub} className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold text-gray-700 uppercase flex-1 truncate">{label}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={subBabPercentages[sub] || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setSubBabPercentages(prev => ({ ...prev, [sub]: val }));
                                }}
                                className="w-14 h-7 text-center text-[11px] font-bold text-gray-700 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#4A90D9]"
                              />
                              <span className="text-[10px] font-bold text-gray-500">%</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-1.5 mt-1.5 border-t border-gray-200 flex justify-between items-center">
                        <button
                          onClick={() => {
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
                          }}
                          className="text-[10px] font-black text-indigo-500 uppercase hover:text-indigo-700 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reset
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-500 uppercase">Total:</span>
                          <span className={`text-[10px] font-black uppercase ${effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0) === 100 ? 'text-green-500' : 'text-red-500'
                            }`}>
                            {effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quiz Mode */}
            <div className="p-3 md:p-4 py-3 bg-white border-b border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-[#F0FFF4] flex items-center justify-center border border-[#C6F6D5]">
                  <span className="text-sm">🧭</span>
                </div>
                <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">Mode Navigasi</label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setQuizMode('strict')}
                  className={`h-[40px] md:h-[44px] rounded-[12px] text-[11px] font-black transition-all border-2 flex items-center justify-center gap-1.5 ${quizMode === 'strict'
                    ? 'bg-nike-black border-transparent text-white shadow-lg shadow-black/10'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-nike-grey-500 hover:border-nike-black hover:text-nike-black'
                    }`}
                >
                  🔒 STRICT
                </button>
                <button
                  onClick={() => setQuizMode('standard')}
                  className={`h-[40px] md:h-[44px] rounded-[12px] text-[11px] font-black transition-all border-2 flex items-center justify-center gap-1.5 ${quizMode === 'standard'
                    ? 'bg-[#4A90D9] border-transparent text-white shadow-lg shadow-[#4A90D9]/20'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-nike-grey-500 hover:border-[#4A90D9] hover:text-[#4A90D9]'
                    }`}
                >
                  📋 STANDARD
                </button>
              </div>
              <p className="text-[9px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider">
                {quizMode === 'strict' ? 'Soal harus dikerjakan berurutan, tidak bisa kembali.' : 'Peserta bisa bolak-balik soal dan menandai ragu-ragu.'}
              </p>
            </div>

            {/* Allow Join Mid Game */}
            <div className="p-3 md:p-4 py-3 bg-white border-b border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-[#FFF5F5] flex items-center justify-center border border-[#FED7D7]">
                  <span className="text-sm">🚪</span>
                </div>
                <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">Masuk Tengah Ujian</label>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors relative ${allowJoinMidGame ? 'bg-[#34C759]' : 'bg-gray-300'}`}
                  onClick={() => setAllowJoinMidGame(!allowJoinMidGame)}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${allowJoinMidGame ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <span className={`text-[11px] font-bold ${allowJoinMidGame ? 'text-[#34C759]' : 'text-gray-500'}`}>
                  {allowJoinMidGame ? 'ON (DIIZINKAN)' : 'OFF (DILARANG)'}
                </span>
              </div>
              <p className="text-[9px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider">
                {allowJoinMidGame
                  ? 'Peserta baru BISA bergabung meskipun kuis sudah dimulai.'
                  : 'Peserta baru TIDAK BISA bergabung jika kuis sudah dimulai.'}
              </p>
            </div>

            {/* Duration */}
            <div className="p-3 md:p-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-[#EBF8FF] flex items-center justify-center border border-[#BEE3F8]">
                  <span className="text-sm">⏱️</span>
                </div>
                <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">Durasi Waktu</label>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[30, 60, 90, 120, 150, 180].map(m => (
                  <button
                    key={m}
                    onClick={() => setDurationMinutes(m)}
                    className={`h-[36px] md:h-[40px] rounded-[12px] text-[12px] font-black transition-all border-2 ${durationMinutes === m
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
            <div className="p-3 md:p-4 py-3 bg-[#FAFBFF]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#FFF8E1] flex items-center justify-center border border-[#FFE082]">
                    <span className="text-sm">📅</span>
                  </div>
                  <label className="text-[10px] font-black text-nike-black uppercase tracking-[0.2em]">Schedule Quiz</label>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none ${scheduleEnabled ? 'bg-[#4A90D9]' : 'bg-gray-300'
                    }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${scheduleEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                </button>
              </div>
              {scheduleEnabled && (
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <div className="flex-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Tanggal</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => {
                        setScheduleDate(e.target.value);
                        if (e.target.value === new Date().toISOString().split('T')[0] && scheduleTime < new Date().toTimeString().slice(0, 5)) {
                          setScheduleTime('');
                        }
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      max={new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]}
                      className="w-full min-w-0 max-w-full bg-white border-2 border-[#E2E8F0] rounded-[10px] px-3 h-[38px] text-[12px] font-bold text-nike-black focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Waktu</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      min={scheduleDate === new Date().toISOString().split('T')[0] ? new Date().toTimeString().slice(0, 5) : undefined}
                      className="w-full min-w-0 max-w-full bg-white border-2 border-[#E2E8F0] rounded-[10px] px-3 h-[38px] text-[12px] font-bold text-nike-black focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all"
                    />
                  </div>
                </div>
              )}
              {scheduleEnabled && scheduleDate && scheduleTime && (
                <p className="text-[10px] font-semibold text-[#4A90D9] mt-1.5 flex items-center gap-1">
                  ⏰ Mulai otomatis: {new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="p-3 md:p-4 bg-[#F8FAFC]">
              <button
                onClick={handleCreate}
                disabled={creating || displaySubBabs.length === 0}
                className={`w-full h-[46px] md:h-[50px] rounded-[14px] text-white font-black text-[13px] tracking-[0.2em] transition-all shadow-lg active:scale-[0.98] disabled:opacity-80 ${creating || displaySubBabs.length === 0 ? 'bg-slate-300' : 'bg-nike-black hover:bg-nike-grey-500 shadow-nike-black/10'
                  }`}
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    CREATING...
                  </span>
                ) : displaySubBabs.length === 0 ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>❌</span> TIADAK ADA SOAL
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🚀</span> BUAT KUIS
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
              <h1 className="text-4xl md:text-5xl font-black text-indigo-700 tracking-widest font-mono leading-none mb-3">{activeSession.quiz_code}</h1>
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="text-gray-300">MAPEL:</span> {formatCategorySelectionLabel(activeSession.mapel)}
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="text-gray-300">BAB:</span> {formatCategorySelectionLabel(activeSession.bab)}
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="text-gray-300">SUBBAB:</span> {formatCategorySelectionLabel(activeSession.sub_bab)}
                </div>
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1 mt-1">
                  <span className="text-indigo-200">SOAL:</span> {activeSession.question_count} Questions
                </div>
              </div>
            </div>

            {/* Countdown Timer - shown when quiz is active or paused */}
            {(activeSession.status === 'active' || activeSession.status === 'paused') && activeSession.expires_at && (() => {
              const expiresAt = new Date(activeSession.expires_at).getTime();
              const syncedNow = (activeSession.status === 'paused' && activeSession.paused_at)
                ? new Date(activeSession.paused_at).getTime()
                : currentTime + serverTimeOffset;
              const remainingSec = Math.max(0, Math.ceil((expiresAt - syncedNow) / 1000));
              const h = Math.floor(remainingSec / 3600);
              const m = Math.floor((remainingSec % 3600) / 60);
              const s = remainingSec % 60;
              const isUrgent = remainingSec <= 60;
              const isExpired = remainingSec <= 0;
              return (
                <div className="flex flex-col items-center justify-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {isExpired ? '⏰ Waktu Habis'
                      : activeSession.status === 'paused' ? '⏸️ Sisa Waktu (Paused)'
                        : '⏱️ Sisa Waktu'}
                  </p>
                  <div className="flex items-baseline gap-1 font-mono">
                    <div className="flex flex-col items-center">
                      <span className={`text-3xl md:text-4xl font-black tabular-nums ${isExpired ? 'text-red-500' : 'text-gray-900'}`}>{h.toString().padStart(2, '0')}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Jam</span>
                    </div>
                    <span className={`text-3xl md:text-4xl font-black -mt-1 ${isExpired ? 'text-red-300' : 'text-gray-300'}`}>:</span>
                    <div className="flex flex-col items-center">
                      <span className={`text-3xl md:text-4xl font-black tabular-nums ${isExpired ? 'text-red-500' : 'text-gray-900'}`}>{m.toString().padStart(2, '0')}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Menit</span>
                    </div>
                    <span className={`text-3xl md:text-4xl font-black -mt-1 ${isExpired ? 'text-red-300' : 'text-gray-300'}`}>:</span>
                    <div className="flex flex-col items-center">
                      <span className={`text-3xl md:text-4xl font-black tabular-nums ${isExpired ? 'text-red-500' : isUrgent ? 'text-red-500 animate-pulse' : activeSession.status === 'paused' ? 'text-orange-500' : 'text-gray-900'}`}>{s.toString().padStart(2, '0')}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Detik</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col items-end gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${activeSession.status === 'active' ? 'bg-green-100 text-green-700' :
                activeSession.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                  activeSession.status === 'paused' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                }`}>
                {activeSession.status}
              </span>
              <div className="flex flex-col items-end gap-2">
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
                <div className="flex gap-2">
                  {activeSession.status === 'waiting' && (
                    <div className="relative flex items-center">
                      {activeSession.scheduled_at && !editingSchedule ? (
                        <div className="flex items-center gap-3 bg-[#F0F7FF] border border-[#BFDBFE] px-4 py-1.5 rounded-full">
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Mulai otomatis</span>
                            <span className="text-xs font-black text-[#4A90D9] font-mono tabular-nums leading-none">{scheduleCountdown || '...'}</span>
                          </div>
                          <div className="w-px h-5 bg-[#BFDBFE]"></div>
                          <button
                            onClick={() => {
                              setEditingSchedule(true);
                              const d = new Date(activeSession.scheduled_at!);
                              setEditScheduleDate(d.toISOString().split('T')[0]);
                              setEditScheduleTime(d.toTimeString().slice(0, 5));
                            }}
                            className="text-[10px] font-bold text-[#4A90D9] hover:text-blue-700 uppercase tracking-wider"
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
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditingSchedule(false)}>
                          <div className="w-full max-w-xs bg-white rounded-2xl shadow-2xl border border-gray-200 p-5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold uppercase text-gray-700">📅 Set Schedule</h4>
                              <button onClick={() => setEditingSchedule(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors">✕</button>
                            </div>
                            <div className="space-y-3">
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tanggal</label>
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
                                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 h-10 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#4A90D9] focus:ring-2 focus:ring-[#4A90D9]/10"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Waktu</label>
                                  <input
                                    type="time"
                                    value={editScheduleTime}
                                    onChange={(e) => setEditScheduleTime(e.target.value)}
                                    min={editScheduleDate === new Date().toISOString().split('T')[0] ? new Date().toTimeString().slice(0, 5) : undefined}
                                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 h-10 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#4A90D9] focus:ring-2 focus:ring-[#4A90D9]/10"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-3 border-t border-gray-100">
                                <button onClick={handleSaveSchedule} className="flex-1 bg-[#4A90D9] text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-600 transition-colors">Simpan</button>
                                {activeSession.scheduled_at && (
                                  <button onClick={handleRemoveSchedule} className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-600 transition-colors">Hapus</button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setShowViewQuestions(true);
                      setLoadingAllAnswers(true);
                      const allAnswers: KuisResult[] = [];
                      for (const p of players) {
                        const ans = await fetchPlayerAnswers(p.id);
                        allAnswers.push(...ans);
                      }
                      setAllPlayerAnswers(allAnswers);
                      setLoadingAllAnswers(false);
                    }}
                    className="px-6 py-2 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📋</span> Questions
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center gap-4 bg-gray-50">
              <h3 className="font-bold text-gray-900">Players ({players.length})</h3>
              <button
                type="button"
                onClick={() => setShowLeaderboardView(true)}
                disabled={players.length === 0}
                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>🏁</span>
                Leaderboard View
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    {activeSession.quiz_mode !== 'standard' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
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
                      {activeSession.quiz_mode !== 'standard' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <span className="font-semibold" title={`Soal saat ini: ${resolveCurrentLabel(p)}`}>{resolveCurrentLabel(p)}</span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                        {activeSession.quiz_mode === 'standard' && !p.finished_at ? (
                          <span className="text-gray-400">? / {activeSession.question_count}</span>
                        ) : (
                          `${p.score} / ${activeSession.question_count}`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activeSession.quiz_mode === 'standard' && !p.finished_at ? (
                          <span className="text-gray-400">--:--</span>
                        ) : (
                          formatHMS(p.total_time)
                        )}
                      </td>
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

          {activeView === 'history' && (() => {
            const filteredHistory = history.filter(h => {
              if (historyFilterMapels.length > 0) {
                if (!h.mapel) return false;
                if (h.mapel !== 'Semua MAPEL') {
                  const hMapels = h.mapel.split(',').map(s => s.trim());
                  if (!hMapels.some(m => historyFilterMapels.includes(m))) return false;
                }
              }
              if (historyFilterBabs.length > 0) {
                if (!h.bab) return false;
                if (h.bab !== 'Semua BAB') {
                  const hBabs = h.bab.split(',').map(s => s.trim());
                  if (!hBabs.some(b => historyFilterBabs.includes(b))) return false;
                }
              }
              if (historyFilterSubBabs.length > 0) {
                if (!h.sub_bab) return false;
                if (h.sub_bab !== 'Semua Sub-bab') {
                  const hSubBabs = h.sub_bab.split(',').map(s => s.trim());
                  if (!hSubBabs.some(sb => historyFilterSubBabs.includes(sb))) return false;
                }
              }
              return true;
            });

            const historyMapelOptions = mapels.map(m => ({ label: m.replace(/_/g, ' '), value: m }));
            const historyBabOptions = babs.map(b => ({ label: b.replace(/_/g, ' '), value: b }));
            const historySubBabOptions = subBabs;

            return (
              <div className="space-y-4">
                <div className="bg-white shadow sm:rounded-lg border border-gray-200 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-black text-nike-black uppercase tracking-widest opacity-60">Mapel</span>
                      <MultiSelectDropdown
                        label="Mapel"
                        options={historyMapelOptions}
                        selectedValues={historyFilterMapels}
                        onChange={setHistoryFilterMapels}
                        placeholder="Semua Mapel"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-black text-nike-black uppercase tracking-widest opacity-60">Bab</span>
                      <MultiSelectDropdown
                        label="Bab"
                        options={historyBabOptions}
                        selectedValues={historyFilterBabs}
                        onChange={setHistoryFilterBabs}
                        placeholder="Semua Bab"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-black text-nike-black uppercase tracking-widest opacity-60">Sub-bab</span>
                      <MultiSelectDropdown
                        label="Sub-bab"
                        options={historySubBabOptions}
                        selectedValues={historyFilterSubBabs}
                        onChange={setHistoryFilterSubBabs}
                        placeholder="Semua Sub-bab"
                      />
                    </div>
                  </div>
                </div>

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
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No history found.</td>
                          </tr>
                        ) : filteredHistory.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage).map(h => (
                          <tr key={h.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                              <span className="block max-w-[140px] truncate" title={h.quiz_code}>{h.quiz_code}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                              <span
                                className="block max-w-[220px] truncate"
                                title={`${h.mapel?.replace(/_/g, ' ')} - ${h.bab?.replace(/_/g, ' ')} - ${h.sub_bab?.replace(/_/g, ' ')}`}
                              >
                                {h.mapel?.replace(/_/g, ' ')} - {h.bab?.replace(/_/g, ' ')} - {h.sub_bab?.replace(/_/g, ' ')}
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
                  {filteredHistory.length > historyPerPage && (
                    <Pagination
                      totalItems={filteredHistory.length}
                      itemsPerPage={historyPerPage}
                      currentPage={historyPage}
                      onPageChange={setHistoryPage}
                    />
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}

      <LeaderboardViewModal
        open={showLeaderboardView && !!activeSession}
        session={activeSession}
        players={players}
        onClose={() => setShowLeaderboardView(false)}
        currentTime={currentTime}
        serverTimeOffset={serverTimeOffset}
      />

      {/* Player Answers Modal */}
      {viewingPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[10000]" onClick={() => setViewingPlayer(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b bg-gray-50 relative">
              <div className="flex justify-between items-start w-full">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl mt-1">
                    {viewingPlayer.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 leading-tight mb-1">
                      {viewingPlayer.name}
                    </h2>
                    <div className="space-y-1">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                          <span className="text-gray-300">MAPEL:</span> {activeSession?.mapel?.replaceAll('_', ' ') || '-'}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                          <span className="text-gray-300">BAB:</span> {activeSession?.bab?.replaceAll('_', ' ') || '-'}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                          <span className="text-gray-300">SUBBAB:</span> {activeSession?.sub_bab?.replaceAll('_', ' ') || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                  <p className="text-2xl font-black text-gray-900">{formatHMS(viewingPlayer.total_time)}</p>
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
                    const allIds = viewingPlayer.question_ids || activeSession?.question_ids || [];
                    const answeredIds = playerAnswers.map(a => a.question_id);

                    // Display exactly in the order the user received them
                    const orderedIds = [
                      ...allIds,
                      ...answeredIds.filter(id => !allIds.includes(id))
                    ];

                    return orderedIds.map((qId, idx) => {
                      const question = sessionQuestions.find(q => q.id === qId);
                      const answer = playerAnswers.find(a => a.question_id === qId);

                      if (!question) return null;

                      const isShortAnswer = question.question_type === 'short_answer';
                      const correctText = isShortAnswer
                        ? question.short_answer
                        : (question as any)[`option_${question.correct_answer.toLowerCase()}`];

                      return (
                        <div key={`${qId}-${idx}`} className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
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
                                  <p className="text-[9px] text-gray-400 mt-2">Time taken: {formatHMS(answer.time_taken)}</p>
                                </div>

                                {!answer.is_correct && (
                                  <div className="p-4 rounded-xl border-2 border-green-100 bg-green-50/20">
                                    <p className="text-[10px] font-black text-green-600 uppercase mb-2">
                                      Correct Answer{isShortAnswer ? '' : ` (${question.correct_answer})`}
                                    </p>
                                    <RichContent html={correctText} className="text-sm font-medium text-green-800" />
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[10000]">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Question Analytics</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {activeSession.question_count} Soal • {players.length} Pemain
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAllAnswers(!showAllAnswers)}
                  className={`h-10 px-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2 ${showAllAnswers
                    ? 'bg-indigo-600 border-transparent text-white shadow-lg shadow-indigo-200'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-600 hover:text-indigo-600'
                    }`}
                >
                  {showAllAnswers ? '👁️ Hide Answers' : '👁️ Show Answers'}
                </button>
                <button onClick={() => setShowViewQuestions(false)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all">✕</button>
              </div>
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

                    const isShortAnswer = question.question_type === 'short_answer';
                    const correctLabel = question.correct_answer;
                    const correctOptionText = isShortAnswer
                      ? question.short_answer
                      : (question as any)[`option_${correctLabel.toLowerCase()}`];
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
                          {showAllAnswers && (
                            <div className="p-4 rounded-xl border-2 border-green-100 bg-green-50/30">
                              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Jawaban Benar</p>
                              <RichContent html={correctOptionText} className="text-sm font-medium text-green-800" />
                            </div>
                          )}

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
