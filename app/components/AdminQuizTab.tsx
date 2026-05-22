"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';
import { supabase } from '@/lib/supabase';
import { fetchQuizPlayers, fetchQuizHistory, fetchActiveSessions, fetchPlayerAnswers, fetchPlayerQuestionIds, formatHMS, invalidateQuizHistoryCache, type KuisLog, type Player, type KuisStatus, type KuisResult } from '@/lib/quiz';
import { createQuizSessionAction, deleteQuizSessionAction, updateQuizScheduleAction, updateQuizStatusAction } from '@/app/actions/admin/quiz';
import { fetchQuestionsByIds, fetchSubBabsAdmin, type RawQuestion, type SubBabInfo } from '@/lib/questions';
import { formatCategorySelectionLabel } from '@/lib/categories';
import RichContent from '@/app/components/RichContent';
import MultiSelectDropdown from '@/app/components/MultiSelectDropdown';
import LeaderboardViewModal from '@/app/components/LeaderboardViewModal';
import { ToastContainer, type ToastMessage } from '@/app/components/Toast';

export default function AdminQuizTab({ mapels, babs, subBabs, theme = 'dark' }: { mapels: string[], babs: string[], subBabs: { label: string, value: string }[], theme?: 'light' | 'dark' }) {
  const [activeView, setActiveView] = useState<'create' | 'manage' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_quiz_active_view');
      if (saved === 'create' || saved === 'manage' || saved === 'history') return saved;
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
  const [createErrorModal, setCreateErrorModal] = useState<{
    availableCount: number;
    requestedCount: number;
    mapels: string[];
    babs: string[];
    subBabs: string[];
  } | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Sync props initially or when they change
  useEffect(() => {
    const syncDefaults = async () => {
      if (selectedMapels.length === 0) {
        setDisplayBabs([]);
      }
      if (selectedBabs.length === 0) {
        setDisplaySubBabs([]);
      }
    };
    void syncDefaults();
  }, [babs, subBabs, selectedMapels, selectedBabs]);

  // Dynamic bab loading based on selectedMapels
  useEffect(() => {
    const loadBabs = async () => {
      if (selectedMapels.length === 0) {
        setDisplayBabs([]);
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
        setDisplaySubBabs([]);
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
  const [expandedPlayerQuestions, setExpandedPlayerQuestions] = useState<Set<number>>(new Set());

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
  const [currentTime, setCurrentTime] = useState(0);
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0); // server - local offset in ms
  const [manageItemsPerPage, setManageItemsPerPage] = useState(10);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
  const [playersItemsPerPage, setPlayersItemsPerPage] = useState(10);
  const pageSizeOptions = [5, 10, 25, 50, 100];
  const autoFinishRef = useRef(false);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const playerAnswersChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hasInitializedFromUrl = useRef(false);
  const trackedPlayerIdsRef = useRef<Set<string>>(new Set());

  // Handle URL query parameters for quiz highlighting
  const searchParams = useSearchParams();

  useEffect(() => {
    if (activeSession) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [activeSession]);

  // Sync URL parameters to state (URL → State)
  useEffect(() => {
    const code = searchParams.get('code');

    if (code) {
      // Mark that we've seen a code in URL
      hasInitializedFromUrl.current = true;

      // Switch to manage view only if this is a new session being loaded
      // Don't force view change if user is already viewing this session
      if ((!activeSession || activeSession.quiz_code !== code) && activeView !== 'manage') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveView('manage');
      }

      // Find and set the quiz session with this code if not already set
      if (!activeSession || activeSession.quiz_code !== code) {
        // Check in active sessions first
        const session = activeSessions.find(s => s.quiz_code === code);
        if (session) {
          setActiveSession(session);
          return;
        }

        // If not found in active sessions, check history
        const historySession = history.find(h => h.quiz_code === code);
        if (historySession) {
          setActiveSession(historySession);
        }
      }
    } else {
      // No code in URL, clear active session
      if (activeSession) {
        setActiveSession(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeSessions, history, activeView]);

  // Sync state to URL parameters (State → URL)
  useEffect(() => {
    const currentCode = searchParams.get('code');
    const newCode = activeSession?.quiz_code;

    // Only ADD code to URL when activeSession is set
    // Never automatically remove code - that's handled by close button
    if (newCode && currentCode !== newCode) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('code', newCode);
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [activeSession, searchParams]);

  const nowDateInput = new Date(currentTime).toISOString().split('T')[0];
  const nowTimeInput = new Date(currentTime).toTimeString().slice(0, 5);
  const maxDateInput = new Date(currentTime + 2 * 86400000).toISOString().split('T')[0];
  const getQuestionOptionText = useCallback((question: RawQuestion, label: string): string => {
    const normalized = label.toLowerCase();
    if (normalized === 'a') return question.option_a;
    if (normalized === 'b') return question.option_b;
    if (normalized === 'c') return question.option_c;
    if (normalized === 'd') return question.option_d;
    if (normalized === 'e') return question.option_e;
    return '';
  }, []);

  const updateQuizStatus = useCallback(async (id: string, status: KuisStatus) => {
    const token = await getAdminAccessToken();
    const result = await updateQuizStatusAction(token, id, status);
    if (status === 'finished') {
      invalidateQuizHistoryCache();
    }
    return result;
  }, []);

  const updateQuizSchedule = useCallback(async (id: string, scheduledAt: string | null) => {
    const token = await getAdminAccessToken();
    return updateQuizScheduleAction(token, id, scheduledAt);
  }, []);

  const deleteQuizSession = useCallback(async (id: string) => {
    const token = await getAdminAccessToken();
    const result = await deleteQuizSessionAction(token, id);
    invalidateQuizHistoryCache();
    return result;
  }, []);

  const handleCloseSession = useCallback(() => {
    // Remove code from URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('code');
    window.history.replaceState({}, '', newUrl.toString());

    // Clear active session
    setActiveSession(null);
  }, []);

  const createQuizSession = useCallback(async (
    mapel: string | string[],
    bab: string | string[],
    subBabs: string[],
    questionCountArg: number,
    durationMinutesArg: number,
    scheduledAt?: string,
    percentages?: Record<string, number>,
    quizModeArg?: 'strict' | 'standard',
    allowJoinMidGameArg?: boolean,
  ) => {
    const token = await getAdminAccessToken();
    return createQuizSessionAction(token, {
      mapel,
      bab,
      subBabs,
      questionCount: questionCountArg,
      durationMinutes: durationMinutesArg,
      scheduledAt,
      percentages,
      quizMode: quizModeArg,
      allowJoinMidGame: allowJoinMidGameArg,
    });
  }, []);

  useEffect(() => {
    const syncNow = async () => {
      setCurrentTime(Date.now());
    };
    void syncNow();
  }, []);

  useEffect(() => {
    const resetPagination = async () => {
      setActivePage(1);
      setHistoryPage(1);
      setPlayersPage(1);
    };
    void resetPagination();
  }, [activeView, activeSession]);


  useEffect(() => {
    autoFinishRef.current = false;
  }, [activeSession?.id]);

  useEffect(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    if (activeSession) {
      fetchQuizPlayers(activeSession.id).then(setPlayers);

      if (activeSession.status !== 'finished') {
        const debouncedFetchPlayers = () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchQuizPlayers(activeSession.id).then(setPlayers);
          }, 400);
        };

        realtimeChannelRef.current = supabase
          .channel(`quiz_admin_${activeSession.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'player', filter: `kuis_id=eq.${activeSession.id}` },
            () => {
              debouncedFetchPlayers();
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'kuis_results' },
            (payload) => {
              const playerId = (payload.new as { player_id?: string })?.player_id;
              if (playerId && trackedPlayerIdsRef.current.has(playerId)) {
                setPlayerProgress((prev) => ({
                  ...prev,
                  [playerId]: (prev[playerId] || 0) + 1,
                }));
              }
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
      if (activeView === 'history') {
        fetchQuizHistory().then(setHistory);
      } else if (activeView === 'manage') {
        fetchActiveSessions().then(setActiveSessions);
      }
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [activeView, activeSession]);

  const playerIdsKey = useMemo(
    () => players.map((p) => p.id).sort().join(','),
    [players]
  );

  useEffect(() => {
    trackedPlayerIdsRef.current = new Set(players.map((p) => p.id));
  }, [playerIdsKey, players]);

  useEffect(() => {
    const loadProgress = async () => {
      if (!activeSession) {
        setPlayerProgress({});
        return;
      }

      const playerIds = playerIdsKey ? playerIdsKey.split(',') : [];
      if (playerIds.length === 0) {
        setPlayerProgress({});
        return;
      }

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
  }, [activeSession, playerIdsKey]);

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
  }, [activeSession, players, updateQuizStatus]);

  // Safety-net poll for the session details modal: keeps players + session
  // data fresh in case any realtime event is missed. Pauses when tab hidden.
  useEffect(() => {
    if (!activeSession) return;
    if (activeSession.status === 'finished') return;

    const sessionId = activeSession.id;
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      const [latestPlayers, latestSessions] = await Promise.all([
        fetchQuizPlayers(sessionId),
        fetchActiveSessions(),
      ]);

      if (cancelled) return;

      setPlayers(latestPlayers);
      const updated = latestSessions.find((s) => s.id === sessionId);
      if (updated) {
        setActiveSession((prev) => {
          if (!prev || prev.id !== sessionId) return prev;
          if (
            prev.status === updated.status
            && prev.started_at === updated.started_at
            && prev.scheduled_at === updated.scheduled_at
            && prev.duration_minutes === updated.duration_minutes
            && prev.player_count === updated.player_count
          ) {
            return prev;
          }
          return updated;
        });
      }
    };

    const interval = setInterval(refresh, 5000);

    const onVisibilityChange = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeSession, activeSession?.id, activeSession?.status]);

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
  }, [activeSession, updateQuizStatus]);

  useEffect(() => {
    const syncSessionQuestions = async () => {
      if (activeSession) {
        const questions = await fetchQuestionsByIds(activeSession.question_ids || []);
        setSessionQuestions(questions);
      } else {
        setSessionQuestions([]);
      }
    };

    void syncSessionQuestions();
  }, [activeSession]);

  useEffect(() => {
    if (playerAnswersChannelRef.current) {
      supabase.removeChannel(playerAnswersChannelRef.current);
      playerAnswersChannelRef.current = null;
    }

    const syncViewingPlayer = async () => {
      if (viewingPlayer) {
        if (!viewingPlayer.question_ids || viewingPlayer.question_ids.length === 0) {
          const qIds = await fetchPlayerQuestionIds(viewingPlayer.id);
          if (qIds && qIds.length > 0) {
            setViewingPlayer(prev => prev && prev.id === viewingPlayer.id ? { ...prev, question_ids: qIds } : prev);
          }
        }

        setLoadingAnswers(true);
        const ans = await fetchPlayerAnswers(viewingPlayer.id);
        setPlayerAnswers(ans);
        setLoadingAnswers(false);

        if (activeSession?.status !== 'finished') {
          // Append a unique suffix so React StrictMode / fast re-renders don't
          // hand us back a cached channel that's already subscribed (which
          // makes `.on()` throw "cannot add postgres_changes callbacks after
          // subscribe()").
          const channelName = `player_answers_${viewingPlayer.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const channel = supabase.channel(channelName)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'kuis_results', filter: `player_id=eq.${viewingPlayer.id}` },
              () => {
                fetchPlayerAnswers(viewingPlayer.id).then(setPlayerAnswers);
              }
            )
            .subscribe();
          playerAnswersChannelRef.current = channel;
        }
      } else {
        setPlayerAnswers([]);
      }
    };

    void syncViewingPlayer();

    return () => {
      if (playerAnswersChannelRef.current) {
        supabase.removeChannel(playerAnswersChannelRef.current);
        playerAnswersChannelRef.current = null;
      }
    };
  }, [viewingPlayer, activeSession]);

  const handleCreate = async () => {
    if (selectedMapels.length === 0 || selectedBabs.length === 0 || selectedSubBabs.length === 0) {
      showToast('Pilih MAPEL, BAB, dan Sub-bab terlebih dahulu.', 'error');
      return;
    }

    const { count: availableCount, error: countError } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('is_hidden', false)
      .overlaps('mapels', selectedMapels)
      .overlaps('babs', selectedBabs)
      .overlaps('sub_babs', selectedSubBabs);

    if (countError) {
      showToast('Gagal memeriksa jumlah soal tersedia.', 'error');
      return;
    }

    if ((availableCount || 0) < questionCount) {
      setCreateErrorModal({
        availableCount: availableCount || 0,
        requestedCount: questionCount,
        mapels: selectedMapels,
        babs: selectedBabs,
        subBabs: selectedSubBabs,
      });
      return;
    }

    setCreating(true);
    let scheduledAt: string | undefined;
    if (scheduleEnabled && scheduleDate && scheduleTime) {
      const target = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (target.getTime() <= currentTime) {
        alert('Waktu schedule tidak boleh di masa lalu.');
        setCreating(false);
        return;
      }
      scheduledAt = target.toISOString();
    }
    const effectiveSubBabs = selectedSubBabs;

    if (percentagesEnabled) {
      const totalPct = effectiveSubBabs.reduce((acc, val) => acc + (subBabPercentages[val] || 0), 0);
      if (totalPct !== 100) {
        alert('Total persentase soal harus 100%. Saat ini: ' + totalPct + '%');
        setCreating(false);
        return;
      }
    }

    const session = await createQuizSession(
      selectedMapels,
      selectedBabs,
      selectedSubBabs,
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
      showToast("Tidak ada soal tersedia. Silakan tambahkan soal terlebih dahulu.", "error");
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

  const handleRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    invalidateQuizHistoryCache();

    try {
      if (activeSession) {
        const [sessions, latestHistory, latestPlayers] = await Promise.all([
          fetchActiveSessions(),
          fetchQuizHistory({ force: true }),
          fetchQuizPlayers(activeSession.id),
        ]);

        const latestSession = sessions.find((session) => session.id === activeSession.id)
          ?? latestHistory.find((session) => session.id === activeSession.id)
          ?? activeSession;

        setActiveSessions(sessions);
        setHistory(latestHistory);
        setActiveSession(latestSession);
        setPlayers(latestPlayers);

        const latestQuestions = await fetchQuestionsByIds(latestSession.question_ids || []);
        setSessionQuestions(latestQuestions);
        return;
      }

      if (activeView === 'history') {
        const latestHistory = await fetchQuizHistory({ force: true });
        setHistory(latestHistory);
        return;
      }

      if (activeView === 'manage') {
        const latestSessions = await fetchActiveSessions();
        setActiveSessions(latestSessions);
      }
    } finally {
      setRefreshing(false);
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
    if (target.getTime() <= currentTime) {
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
      const resetScheduleCountdown = async () => {
        setScheduleCountdown(null);
      };
      void resetScheduleCountdown();
      return;
    }

    const targetTime = new Date(activeSession.scheduled_at).getTime();

    const tick = async () => {
      const now = currentTime;
      const diff = targetTime - now;

      if (diff <= 0) {
        setScheduleCountdown('Memulai...');

        const { count } = await supabase.from('public_players').select('*', { count: 'exact', head: true }).eq('kuis_id', activeSession.id);
        if (count === 0) {
          await deleteQuizSession(activeSession.id);
          handleCloseSession();
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
      setScheduleCountdown(hours > 0 ? `${hours}j ${minutes}m ${seconds}d` : `${minutes}m ${seconds}d`);
    };

    void tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession, activeSession?.id, activeSession?.status, activeSession?.scheduled_at, currentTime, deleteQuizSession, handleCloseSession, updateQuizStatus]);

  // Refresh active sessions list when admin returns to the manage view.
  // Auto-start of scheduled quizzes is handled server-side by pg_cron;
  // we only need to keep the displayed list in sync.
  useEffect(() => {
    if (activeView !== 'manage' || activeSession) return;

    let cancelled = false;

    const refresh = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const sessions = await fetchActiveSessions();
      if (cancelled) return;
      setActiveSessions(sessions);
    };

    void refresh();

    const onVisibilityChange = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
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
      if (typeof document !== 'undefined' && document.hidden) return;
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

    const onVisibilityChange = () => {
      if (!document.hidden) void syncServerTime();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeSession?.status]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className={`mb-4 shrink-0 rounded-3xl px-5 py-4 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <h2 className={`text-[20px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Quiz</h2>
            <p className={`mt-0.5 text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
              {activeSession ? 'Pantau sesi quiz, pemain, dan leaderboard secara live.' : activeView === 'history' ? 'Review riwayat quiz yang sudah selesai.' : activeView === 'manage' ? 'Kelola sesi quiz aktif, waiting, dan paused.' : 'Buat sesi quiz live dari topik pilihan.'}
            </p>
          </div>
          {(activeView !== 'create' || activeSession) && (
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className={`h-9 rounded-full px-4 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className={`inline-flex h-9 rounded-full p-0.5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
            <button
              type="button"
              onClick={() => setActiveView('create')}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${activeView === 'create' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setActiveView('manage')}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${activeView === 'manage' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              Manage
            </button>
            <button
              type="button"
              onClick={() => setActiveView('history')}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${activeView === 'history' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {activeView === 'create' && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mx-auto max-w-2xl px-3 py-3 md:px-0 md:py-4">
          {/* Header Card - Compact */}
          <div className={`mb-3 rounded-[20px] border p-4 shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-[#e5e5e5] bg-white'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${theme === 'dark' ? 'bg-accent-blue/15' : 'bg-blue-50'}`}>
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-accent-blue' : 'text-blue-600'}`}>Q</span>
              </div>
              <div>
                <h3 className={`text-sm font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Buat kuis baru</h3>
                <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Sesi kuis live dari topik pilihan.</p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className={`overflow-hidden rounded-[24px] border shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-[#e5e5e5] bg-white'}`}>
            {/* MAPEL & BAB & Sub-bab */}
            <div className="p-3 md:p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className={`mb-1.5 block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mapel</label>
                <div className="relative">
                  <div
                    onClick={() => setIsMapelOpen(!isMapelOpen)}
                    className={`w-full border rounded-xl px-3 min-h-[36px] py-1.5 flex items-center justify-between cursor-pointer transition-spring-fast ${theme === 'dark' ? 'bg-dark-750 border-dark-border hover:border-accent-blue/50' : 'bg-gray-50 border-gray-200 hover:border-blue-400'}`}
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedMapels.length === 0 ? (
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>None Selected</span>
                      ) : (
                        selectedMapels.map(m => (
                          <span key={m} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${theme === 'dark' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-blue-100 text-blue-700'}`}>
                            {m}
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const next = selectedMapels.filter(v => v !== m);
                              setSelectedMapels(next);
                              setSelectedBabs([]);
                              setSelectedSubBabs([]);
                            }} className={theme === 'dark' ? 'hover:text-accent-blue/80' : 'hover:text-blue-900'}>&times;</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`w-3 h-3 transition-transform ${isMapelOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isMapelOpen && (
                    <div className={`absolute z-20 w-full mt-1.5 border rounded-xl max-h-[280px] overflow-y-auto shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                      <div
                        className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border hover:bg-dark-750' : 'border-gray-100 hover:bg-gray-50'}`}
                        onClick={() => {
                          setSelectedMapels([]);
                          setSelectedBabs([]);
                          setSelectedSubBabs([]);
                          setIsMapelOpen(false);
                        }}
                      >
                        <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selectedMapels.length === 0 ? (theme === 'dark' ? 'bg-accent-blue border-accent-blue' : 'bg-blue-500 border-blue-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                          {selectedMapels.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>None Selected</span>
                      </div>
                      {mapels.map(m => {
                        const isSelected = selectedMapels.includes(m);
                        return (
                          <div
                            key={m}
                            className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border-subtle hover:bg-dark-750' : 'border-gray-50 hover:bg-gray-50'}`}
                            onClick={() => {
                              const next = isSelected ? selectedMapels.filter(v => v !== m) : [...selectedMapels, m];
                              setSelectedMapels(next);
                              setSelectedBabs([]);
                              setSelectedSubBabs([]);
                            }}
                          >
                            <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? (theme === 'dark' ? 'bg-accent-blue border-accent-blue' : 'bg-blue-500 border-blue-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                              {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{m}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <label className={`mb-1.5 block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Bab</label>
                <div className="relative">
                  <div
                    onClick={() => {
                      if (selectedMapels.length === 0) return;
                      setIsBabOpen(!isBabOpen);
                    }}
                    className={`w-full border rounded-xl px-3 min-h-[36px] py-1.5 flex items-center justify-between transition-spring-fast ${selectedMapels.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${theme === 'dark' ? 'bg-dark-750 border-dark-border hover:border-accent-blue/50' : 'bg-gray-50 border-gray-200 hover:border-blue-400'}`}
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedBabs.length === 0 ? (
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>None Selected</span>
                      ) : (
                        selectedBabs.map(b => (
                          <span key={b} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${theme === 'dark' ? 'bg-accent-red/20 text-accent-red' : 'bg-red-100 text-red-700'}`}>
                            {b}
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const next = selectedBabs.filter(v => v !== b);
                              setSelectedBabs(next);
                              setSelectedSubBabs([]);
                            }} className={theme === 'dark' ? 'hover:text-accent-red/80' : 'hover:text-red-900'}>&times;</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`w-3 h-3 transition-transform ${isBabOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isBabOpen && (
                    <div className={`absolute z-20 w-full mt-1.5 border rounded-xl max-h-[280px] overflow-y-auto shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                      <div
                        className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border hover:bg-dark-750' : 'border-gray-100 hover:bg-gray-50'}`}
                        onClick={() => {
                          setSelectedBabs([]);
                          setSelectedSubBabs([]);
                          setIsBabOpen(false);
                        }}
                      >
                        <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selectedBabs.length === 0 ? (theme === 'dark' ? 'bg-accent-red border-accent-red' : 'bg-red-500 border-red-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                          {selectedBabs.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>None Selected</span>
                      </div>
                      {selectedMapels.length === 0 ? (
                        <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Pilih MAPEL terlebih dahulu</div>
                      ) : loadingBabs ? (
                        <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>Loading BAB...</div>
                      ) : displayBabs.length > 0 ? (
                        displayBabs.map(b => {
                          const isSelected = selectedBabs.includes(b);
                          return (
                            <div
                              key={b}
                              className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border-subtle hover:bg-dark-750' : 'border-gray-50 hover:bg-gray-50'}`}
                              onClick={() => {
                                const next = isSelected ? selectedBabs.filter(v => v !== b) : [...selectedBabs, b];
                                setSelectedBabs(next);
                                setSelectedSubBabs([]);
                              }}
                            >
                              <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? (theme === 'dark' ? 'bg-accent-red border-accent-red' : 'bg-red-500 border-red-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                                {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{b}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No BAB found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <label className={`mb-1.5 block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Sub-bab</label>
                <div className="relative">
                  <div
                    onClick={() => {
                      if (selectedBabs.length === 0) return;
                      setIsSubBabOpen(!isSubBabOpen);
                    }}
                    className={`w-full border rounded-xl px-3 min-h-[36px] py-1.5 flex items-center justify-between transition-spring-fast ${selectedBabs.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${theme === 'dark' ? 'bg-dark-750 border-dark-border hover:border-accent-blue/50' : 'bg-gray-50 border-gray-200 hover:border-blue-400'}`}
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedSubBabs.length === 0 ? (
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>None Selected</span>
                      ) : (
                        selectedSubBabs.map(v => {
                          const label = displaySubBabs.find(d => d.value === v)?.label || v;
                          return (
                            <span key={v} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${theme === 'dark' ? 'bg-accent-purple/20 text-accent-purple' : 'bg-indigo-100 text-indigo-700'}`}>
                              {label}
                              <button onClick={(e) => {
                                e.stopPropagation();
                                const next = selectedSubBabs.filter(s => s !== v);
                                setSelectedSubBabs(next);
                                const newPct = { ...subBabPercentages };
                                delete newPct[v];
                                setSubBabPercentages(newPct);
                              }} className={theme === 'dark' ? 'hover:text-accent-purple/80' : 'hover:text-indigo-900'}>&times;</button>
                            </span>
                          );
                        })
                      )}
                    </div>
                    <svg className={`w-3 h-3 transition-transform ${isSubBabOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isSubBabOpen && (
                    <div className={`absolute z-10 w-full mt-1.5 border rounded-xl max-h-[280px] overflow-y-auto shadow-lg ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-200'}`}>
                      <div
                        className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border hover:bg-dark-750' : 'border-gray-100 hover:bg-gray-50'}`}
                        onClick={() => {
                          setSelectedSubBabs([]);
                          setSubBabPercentages({});
                          setIsSubBabOpen(false);
                        }}
                      >
                        <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selectedSubBabs.length === 0 ? (theme === 'dark' ? 'bg-accent-purple border-accent-purple' : 'bg-indigo-500 border-indigo-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                          {selectedSubBabs.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>None Selected</span>
                      </div>

                      {selectedBabs.length === 0 ? (
                        <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Pilih BAB terlebih dahulu</div>
                      ) : loadingSubBabs ? (
                        <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>Loading...</div>
                      ) : displaySubBabs.length > 0 ? (
                        displaySubBabs.map(sb => {
                          const isSelected = selectedSubBabs.includes(sb.value);
                          return (
                            <div
                              key={sb.value}
                              className={`p-2.5 border-b cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'border-dark-border-subtle hover:bg-dark-750' : 'border-gray-50 hover:bg-gray-50'}`}
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
                              <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? (theme === 'dark' ? 'bg-accent-purple border-accent-purple' : 'bg-indigo-500 border-indigo-500') : (theme === 'dark' ? 'border-dark-border' : 'border-gray-300')}`}>
                                {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{sb.label}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className={`p-2.5 text-center text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No Sub-bab found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Question Count & Duration - Side by Side */}
            <div className={`p-3 md:p-4 border-t ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-100'}`}>
              <div className="grid grid-cols-2 gap-3">
                {/* Question Count Dropdown */}
                <div>
                  <label className={`mb-1.5 block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Jumlah soal</label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className={`w-full h-[36px] rounded-xl px-3 text-[11px] font-bold border transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-primary focus:border-accent-blue' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-400'}`}
                  >
                    {[5, 10, 20, 25, 30, 40, 50, 100].map(n => (
                      <option key={n} value={n}>{n} soal</option>
                    ))}
                  </select>
                </div>

                {/* Duration Dropdown */}
                <div>
                  <label className={`mb-1.5 block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Durasi waktu</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                    className={`w-full h-[36px] rounded-xl px-3 text-[11px] font-bold border transition-spring-fast focus:outline-none ${theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-primary focus:border-accent-green' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-green-400'}`}
                  >
                    {[30, 60, 90, 120, 150, 180].map(m => (
                      <option key={m} value={m}>{m} menit</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Persentase Soal */}
            {(() => {
              const effectiveSubBabs = selectedSubBabs.length > 0 ? selectedSubBabs : displaySubBabs.map(sb => sb.value);
              if (effectiveSubBabs.length === 0) return null;

              return (
                <div className={`p-3 md:p-4 py-3 border-b ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${theme === 'dark' ? 'bg-accent-purple/20 border-accent-purple/30' : 'bg-[#FFF0F6] border-[#FED7E2]'}`}>
                        <span className="text-sm">📊</span>
                      </div>
                      <label className={`text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Persentase soal</label>
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
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${percentagesEnabled ? (theme === 'dark' ? 'bg-accent-blue focus:ring-accent-blue' : 'bg-[#4A90D9] focus:ring-[#4A90D9]') : (theme === 'dark' ? 'bg-dark-700' : 'bg-gray-200')
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
                    <div className={`space-y-2.5 mt-3 p-3 rounded-xl border ${theme === 'dark' ? 'bg-dark-750 border-dark-border' : 'bg-gray-50 border-gray-100'}`}>
                      {effectiveSubBabs.map(sub => {
                        const label = displaySubBabs.find(d => d.value === sub)?.label || sub;
                        return (
                          <div key={sub} className="flex items-center justify-between gap-3">
                            <span className={`flex-1 truncate text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{label}</span>
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
                                className={`w-14 h-7 text-center text-[11px] font-bold border rounded focus:outline-none ${theme === 'dark' ? 'bg-dark-800 border-dark-border text-dark-text-primary focus:border-accent-blue' : 'bg-white border-gray-300 text-gray-700 focus:border-[#4A90D9]'}`}
                              />
                              <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>%</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className={`pt-1.5 mt-1.5 border-t flex justify-between items-center ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'}`}>
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
                          className={`flex items-center gap-1 text-[11px] font-semibold transition-spring-fast hover:scale-[1.02] ${theme === 'dark' ? 'text-accent-purple hover:text-accent-purple/80' : 'text-indigo-500 hover:text-indigo-700'}`}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reset
                        </button>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Total</span>
                          <span className={`text-[11px] font-semibold tabular-nums ${effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0) === 100 ? (theme === 'dark' ? 'text-accent-green' : 'text-green-500') : (theme === 'dark' ? 'text-accent-red' : 'text-red-500')
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
            <div className={`p-3 md:p-4 border-b ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-100'}`}>
              <label className={`mb-2 block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mode navigasi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setQuizMode('strict')}
                  className={`h-[34px] rounded-xl text-[11px] font-bold transition-spring-fast border flex items-center justify-center gap-1.5 ${quizMode === 'strict'
                    ? (theme === 'dark' ? 'bg-dark-text-primary border-transparent text-dark-900' : 'bg-gray-900 border-transparent text-white')
                    : (theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-secondary hover:border-dark-text-primary' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400')
                    }`}
                >
                  🔒 STRICT
                </button>
                <button
                  onClick={() => setQuizMode('standard')}
                  className={`h-[34px] rounded-xl text-[11px] font-bold transition-spring-fast border flex items-center justify-center gap-1.5 ${quizMode === 'standard'
                    ? (theme === 'dark' ? 'bg-accent-blue border-transparent text-white' : 'bg-blue-600 border-transparent text-white')
                    : (theme === 'dark' ? 'bg-dark-750 border-dark-border text-dark-text-secondary hover:border-accent-blue' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-400')
                    }`}
                >
                  📋 STANDARD
                </button>
              </div>
              <p className={`text-[9px] font-medium mt-1.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                {quizMode === 'strict' ? 'Soal harus dikerjakan berurutan, tidak bisa kembali.' : 'Peserta bisa bolak-balik soal dan menandai ragu-ragu.'}
              </p>
            </div>

            {/* Allow Join Mid Game */}
            <div className={`p-3 md:p-4 py-3 border-b ${theme === 'dark' ? 'bg-dark-800 border-dark-border' : 'bg-white border-gray-100'}`}>
              <label className={`mb-2 block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Masuk tengah ujian</label>
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-spring-fast relative ${allowJoinMidGame ? (theme === 'dark' ? 'bg-accent-green' : 'bg-green-500') : (theme === 'dark' ? 'bg-dark-700' : 'bg-gray-300')}`}
                  onClick={() => setAllowJoinMidGame(!allowJoinMidGame)}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${allowJoinMidGame ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <span className={`text-[11px] font-bold ${allowJoinMidGame ? (theme === 'dark' ? 'text-accent-green' : 'text-green-500') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}>
                  {allowJoinMidGame ? 'Diizinkan' : 'Dilarang'}
                </span>
              </div>
              <p className={`text-[9px] font-medium mt-1.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                {allowJoinMidGame
                  ? 'Peserta baru bisa bergabung meskipun kuis sudah dimulai.'
                  : 'Peserta baru tidak bisa bergabung jika kuis sudah dimulai.'}
              </p>
            </div>

            {/* Schedule */}
            <div className={`p-3 md:p-4 ${theme === 'dark' ? 'bg-dark-750' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className={`text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Schedule quiz</label>
                <button
                  type="button"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-spring-fast focus:outline-none ${scheduleEnabled ? (theme === 'dark' ? 'bg-accent-blue' : 'bg-blue-600') : (theme === 'dark' ? 'bg-dark-700' : 'bg-gray-300')
                    }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${scheduleEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                </button>
              </div>
              {scheduleEnabled && (
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <div className="flex-1">
                    <label className={`mb-1 block text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Tanggal</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => {
                        setScheduleDate(e.target.value);
                        if (e.target.value === nowDateInput && scheduleTime < nowTimeInput) {
                          setScheduleTime('');
                        }
                      }}
                      min={nowDateInput}
                      max={maxDateInput}
                      className={`w-full min-w-0 max-w-full border rounded-xl px-3 h-[36px] text-[11px] font-bold focus:outline-none transition-spring-fast ${theme === 'dark' ? 'bg-dark-800 border-dark-border text-dark-text-primary focus:border-accent-blue' : 'bg-white border-gray-200 text-gray-900 focus:border-blue-400'}`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={`mb-1 block text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Waktu</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      min={scheduleDate === nowDateInput ? nowTimeInput : undefined}
                      className={`w-full min-w-0 max-w-full border rounded-xl px-3 h-[36px] text-[11px] font-bold focus:outline-none transition-spring-fast ${theme === 'dark' ? 'bg-dark-800 border-dark-border text-dark-text-primary focus:border-accent-blue' : 'bg-white border-gray-200 text-gray-900 focus:border-blue-400'}`}
                    />
                  </div>
                </div>
              )}
              {scheduleEnabled && scheduleDate && scheduleTime && (
                <p className={`text-[10px] font-medium mt-1.5 flex items-center gap-1 ${theme === 'dark' ? 'text-accent-blue' : 'text-blue-600'}`}>
                  ⏰ Mulai otomatis: {new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className={`p-3 md:p-4 ${theme === 'dark' ? 'bg-dark-750' : 'bg-gray-50'}`}>
              <button
                onClick={handleCreate}
                disabled={creating || selectedMapels.length === 0 || selectedBabs.length === 0 || selectedSubBabs.length === 0}
                className={`w-full h-[44px] rounded-2xl text-white font-bold text-[12px] transition-spring-fast active:scale-[0.98] disabled:opacity-80 ${creating || selectedMapels.length === 0 || selectedBabs.length === 0 || selectedSubBabs.length === 0 ? (theme === 'dark' ? 'bg-dark-700' : 'bg-gray-300') : (theme === 'dark' ? 'bg-accent-green hover:bg-accent-green/90' : 'bg-green-600 hover:bg-green-700')
                  }`}
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : selectedMapels.length === 0 ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>❌</span> Pilih MAPEL dulu
                  </span>
                ) : selectedBabs.length === 0 ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>❌</span> Pilih BAB dulu
                  </span>
                ) : selectedSubBabs.length === 0 ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>❌</span> Pilih Sub-bab dulu
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🚀</span> Buat Kuis
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {activeSession && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[10000]" onClick={handleCloseSession}>
          <div className={`rounded-[28px] shadow-ios-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            <div className={`shrink-0 flex items-center justify-between px-7 py-4 border-b ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
              <h2 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Session Details</h2>
              <button onClick={handleCloseSession} className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-7 py-7 space-y-7">

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-4">
              <div>
                <p className={`text-[11px] font-medium tracking-tight mb-1.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Join code</p>
                <h1 className={`text-5xl md:text-6xl font-semibold tracking-tight font-mono leading-none ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{activeSession.quiz_code}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>{formatCategorySelectionLabel(activeSession.mapel)}</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>{formatCategorySelectionLabel(activeSession.bab)}</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>{formatCategorySelectionLabel(activeSession.sub_bab)}</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-accent-purple/10 text-accent-purple' : 'bg-indigo-50 text-indigo-700'}`}>{activeSession.question_count} questions</span>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${activeSession.status === 'active' ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700') :
                activeSession.status === 'waiting' ? (theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange' : 'bg-amber-50 text-amber-700') :
                activeSession.status === 'paused' ? (theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange' : 'bg-orange-50 text-orange-700') :
                (theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600')
              }`}>
                {activeSession.status}
              </span>
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
              const timerColor = isExpired ? (theme === 'dark' ? 'text-accent-red' : 'text-red-500')
                : isUrgent ? (theme === 'dark' ? 'text-accent-red' : 'text-red-500')
                : activeSession.status === 'paused' ? (theme === 'dark' ? 'text-accent-orange' : 'text-orange-500')
                : (theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900');
              return (
                <div className={`flex items-center justify-between rounded-2xl px-5 py-4 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-medium tracking-tight ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                      {isExpired ? 'Waktu habis' : activeSession.status === 'paused' ? 'Sisa waktu (paused)' : 'Sisa waktu'}
                    </span>
                    <span className={`text-3xl font-semibold tabular-nums tracking-tight font-mono leading-tight ${timerColor} ${isUrgent && !isExpired ? 'animate-pulse' : ''}`}>
                      {h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : activeSession.status === 'paused' ? (theme === 'dark' ? 'bg-accent-orange' : 'bg-orange-500') : (theme === 'dark' ? 'bg-accent-green animate-pulse' : 'bg-green-500 animate-pulse')}`} />
                </div>
              );
            })()}
            <div className="flex flex-wrap items-center gap-2">
              {activeSession.status === 'waiting' && (
                <>
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={players.length === 0}
                    className={`px-4 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${players.length === 0 ? 'opacity-40 cursor-not-allowed' : ''} ${theme === 'dark' ? 'bg-accent-green text-white hover:bg-accent-green/90' : 'bg-green-500 text-white hover:bg-green-600'}`}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className={`px-4 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    Cancel
                  </button>
                </>
              )}
              {(activeSession.status === 'active' || activeSession.status === 'paused') && (
                <>
                  <button
                    onClick={() => handleStatusChange(activeSession.status === 'active' ? 'paused' : 'active')}
                    className={`px-4 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${activeSession.status === 'active' ? (theme === 'dark' ? 'bg-accent-orange hover:bg-accent-orange/90' : 'bg-orange-500 hover:bg-orange-600') : (theme === 'dark' ? 'bg-accent-green hover:bg-accent-green/90' : 'bg-green-500 hover:bg-green-600')}`}
                  >
                    {activeSession.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => setShowEndConfirm(true)}
                    className={`px-4 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    End
                  </button>
                </>
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
                className={`px-4 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
              >
                Questions
              </button>

              {activeSession.status === 'waiting' && (
                <div className="relative flex items-center">
                  {activeSession.scheduled_at && !editingSchedule ? (
                    <button
                      onClick={() => {
                        setEditingSchedule(true);
                        const d = new Date(activeSession.scheduled_at!);
                        setEditScheduleDate(d.toISOString().split('T')[0]);
                        setEditScheduleTime(d.toTimeString().slice(0, 5));
                      }}
                      className={`flex items-center gap-2 px-3.5 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                    >
                      <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-accent-blue/70' : 'text-blue-500/80'}`}>Auto-start</span>
                      <span className="font-mono tabular-nums font-semibold">{scheduleCountdown || '...'}</span>
                    </button>
                  ) : !editingSchedule && (
                    <button
                      onClick={() => {
                        setEditingSchedule(true);
                        setEditScheduleDate('');
                        setEditScheduleTime('');
                      }}
                      className={`px-4 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
                    >
                      Set schedule
                    </button>
                  )}

                  {editingSchedule && (
                    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xl" onClick={() => setEditingSchedule(false)}>
                      <div className={`w-full max-w-xs rounded-[24px] shadow-ios-xl p-5 ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                          <h4 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Set schedule</h4>
                          <button onClick={() => setEditingSchedule(false)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-spring-fast active:scale-90 ${theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className={`text-[11px] font-medium block mb-1.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Tanggal</label>
                            <input
                              type="date"
                              value={editScheduleDate}
                              onChange={(e) => {
                                setEditScheduleDate(e.target.value);
                                if (e.target.value === nowDateInput && editScheduleTime < nowTimeInput) {
                                  setEditScheduleTime('');
                                }
                              }}
                              min={nowDateInput}
                              max={maxDateInput}
                              className={`w-full rounded-xl px-3 h-10 text-[13px] font-medium focus:outline-none transition-spring-fast ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary focus:bg-white/10' : 'bg-black/5 text-gray-900 focus:bg-black/10'}`}
                            />
                          </div>
                          <div>
                            <label className={`text-[11px] font-medium block mb-1.5 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Waktu</label>
                            <input
                              type="time"
                              value={editScheduleTime}
                              onChange={(e) => setEditScheduleTime(e.target.value)}
                              min={editScheduleDate === nowDateInput ? nowTimeInput : undefined}
                              className={`w-full rounded-xl px-3 h-10 text-[13px] font-medium focus:outline-none transition-spring-fast ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary focus:bg-white/10' : 'bg-black/5 text-gray-900 focus:bg-black/10'}`}
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button onClick={handleSaveSchedule} className={`flex-1 h-10 rounded-xl text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}>Simpan</button>
                            {activeSession.scheduled_at && (
                              <button onClick={handleRemoveSchedule} className={`flex-1 h-10 rounded-xl text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Hapus</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-baseline gap-2">
                <h3 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Players</h3>
                <span className={`text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>{players.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={playersItemsPerPage}
                  onChange={(e) => {
                    setPlayersItemsPerPage(Number(e.target.value));
                    setPlayersPage(1);
                  }}
                  className={`h-8 rounded-full px-3 text-[12px] font-medium focus:outline-none transition-spring-fast ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowLeaderboardView(true)}
                  disabled={players.length === 0}
                  className={`inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'bg-accent-orange/10 text-accent-orange hover:bg-accent-orange/20' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                >
                  Leaderboard
                </button>
              </div>
            </div>
            <div className={`min-h-0 flex-1 overflow-auto rounded-2xl ${theme === 'dark' ? 'bg-white/[0.02]' : 'bg-black/[0.015]'}`}>
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className={`px-5 py-3 text-left text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>#</th>
                    <th className={`px-5 py-3 text-left text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Name</th>
                    {activeSession.quiz_mode !== 'standard' && (
                      <th className={`px-5 py-3 text-left text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Current</th>
                    )}
                    <th className={`px-5 py-3 text-left text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Score</th>
                    <th className={`px-5 py-3 text-left text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Waktu</th>
                    <th className={`px-5 py-3 text-right text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}></th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr><td colSpan={6} className={`px-5 py-12 text-center text-[13px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Waiting for players to join...</td></tr>
                  ) : players.slice((playersPage - 1) * playersItemsPerPage, playersPage * playersItemsPerPage).map((p, i) => (
                    <tr key={p.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}`}>
                      <td className={`px-5 py-3 whitespace-nowrap text-[13px] tabular-nums ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>{((playersPage - 1) * playersItemsPerPage) + i + 1}</td>
                      <td className={`px-5 py-3 whitespace-nowrap text-[13px] font-medium ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                        <span className="block max-w-[220px] truncate" title={p.name}>{p.name}</span>
                      </td>
                      {activeSession.quiz_mode !== 'standard' && (
                        <td className={`px-5 py-3 whitespace-nowrap text-[13px] ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                          <span title={`Soal saat ini: ${resolveCurrentLabel(p)}`}>{resolveCurrentLabel(p)}</span>
                        </td>
                      )}
                      <td className={`px-5 py-3 whitespace-nowrap text-[13px] font-semibold tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                        {activeSession.quiz_mode === 'standard' && !p.finished_at ? (
                          <span className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}>?<span className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}>/{activeSession.question_count}</span></span>
                        ) : (
                          <span>{p.score}<span className={`font-normal ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>/{activeSession.question_count}</span></span>
                        )}
                      </td>
                      <td className={`px-5 py-3 whitespace-nowrap text-[13px] tabular-nums font-mono ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                        {activeSession.quiz_mode === 'standard' && !p.finished_at ? (
                          <span className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}>--:--</span>
                        ) : (
                          formatHMS(p.total_time)
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setViewingPlayer(p)}
                          className={`px-3 h-7 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
                        >
                          View answers
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {players.length > playersItemsPerPage && (
              <Pagination
                totalItems={players.length}
                itemsPerPage={playersItemsPerPage}
                currentPage={playersPage}
                onPageChange={setPlayersPage}
                theme={theme}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  )}
  <div className="min-h-0 flex-1 overflow-hidden">
          {activeView === 'manage' && (
            <div className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-[#e5e5e5] bg-white'}`}>
              <div className={`shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-dark-border-subtle bg-white/[0.02]' : 'border-[#e5e5e5] bg-[#f8f8f8]'}`}>
                <h3 className={`text-sm font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Active sessions ({activeSessions.length})</h3>
              </div>
              {activeSessions.length > 0 && (
                <div className={`mx-3 mt-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 sm:mx-6 ${theme === 'dark' ? 'border-dark-border-subtle bg-white/[0.03]' : 'border-[#E5E5E5] bg-black/[0.02]'}`}>
                  <div className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-[#707072]'}`}>
                    Showing {activeSessions.length === 0 ? 0 : ((activePage - 1) * manageItemsPerPage) + 1}-{Math.min(activePage * manageItemsPerPage, activeSessions.length)} of {activeSessions.length}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={manageItemsPerPage}
                      onChange={(event) => {
                        setManageItemsPerPage(Number(event.target.value));
                        setActivePage(1);
                      }}
                      className={`h-8 rounded-full border px-3 text-[11px] font-semibold focus:outline-none ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue' : 'border-[#CACACB] bg-white text-[#111111] focus:border-[#111111]'}`}
                    >
                      {[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                    </select>
                    <div className={`flex h-8 overflow-hidden rounded-full border ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750' : 'border-[#CACACB] bg-white'}`}>
                      <button type="button" onClick={() => setActivePage(Math.max(1, activePage - 1))} disabled={activePage === 1} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>Prev</button>
                      <span className={`flex items-center border-x px-3 text-[11px] font-semibold ${theme === 'dark' ? 'border-dark-border-medium text-dark-text-tertiary' : 'border-[#E5E5E5] text-[#707072]'}`}>{activePage}/{Math.ceil(activeSessions.length / manageItemsPerPage)}</span>
                      <button type="button" onClick={() => setActivePage(Math.min(Math.ceil(activeSessions.length / manageItemsPerPage), activePage + 1))} disabled={activePage === Math.ceil(activeSessions.length / manageItemsPerPage)} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>Next</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto">
                <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-dark-border-subtle' : 'divide-[#f0f0f0]'}`}>
                  <thead className={theme === 'dark' ? 'bg-white/[0.02]' : 'bg-[#f8f8f8]'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Join code</th>
                      <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Status</th>
                      <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Players</th>
                      <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Questions</th>
                      <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Duration</th>
                      <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Expires in</th>
                      <th className={`px-4 py-3 text-right text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-dark-border-subtle bg-dark-800' : 'divide-[#f0f0f0] bg-white'}`}>
                    {activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={`px-4 py-10 text-center text-sm font-medium sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>No active sessions found.</td>
                      </tr>
                    ) : activeSessions.slice((activePage - 1) * manageItemsPerPage, activePage * manageItemsPerPage).map(s => (
                      <tr key={s.id} className={theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}>
                        <td className={`whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-accent-purple' : 'text-indigo-700'}`}>
                          <span className="block max-w-[140px] truncate" title={s.quiz_code}>{s.quiz_code}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${s.status === 'active' ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-100 text-green-700') : s.status === 'paused' ? (theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange' : 'bg-orange-100 text-orange-700') : (theme === 'dark' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-100 text-yellow-700')}`}>{s.status}</span>
                          {s.status === 'waiting' && s.scheduled_at && (
                            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${theme === 'dark' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-600'}`} title={new Date(s.scheduled_at).toLocaleString('id-ID')}>
                              {new Date(s.scheduled_at).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 text-sm font-semibold tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{s.player_count || 0}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{s.question_count}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{s.duration_minutes} min</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                          {s.expires_at ? (
                            <span className={`font-semibold tabular-nums ${s.status === 'active' || s.status === 'paused' ? (theme === 'dark' ? 'text-accent-purple' : 'text-indigo-600') : (theme === 'dark' ? 'text-accent-red' : 'text-red-500')}`}>
                              {(() => {
                                const referenceTime = (s.status === 'paused' && s.paused_at) ? new Date(s.paused_at).getTime() : currentTime;
                                const diff = new Date(s.expires_at).getTime() - referenceTime;
                                if (diff <= 0) return 'Expired';
                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                              })()}
                            </span>
                          ) : (
                            <span className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}>-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium sm:px-6 sm:py-4">
                          <button onClick={() => setActiveSession(s)} className={`h-8 rounded-full px-3.5 text-[11px] font-semibold transition-spring-fast hover:scale-[1.02] ${theme === 'dark' ? 'bg-accent-purple/15 text-accent-purple hover:bg-accent-purple/25' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>View detail</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

            const splitCategory = (value?: string | null) => String(value || '').split(',').map(s => s.trim()).filter(Boolean);
            const historyForSelectedMapels = historyFilterMapels.length > 0
              ? history.filter(h => h.mapel === 'Semua MAPEL' || splitCategory(h.mapel).some(m => historyFilterMapels.includes(m)))
              : [];
            const historyForSelectedBabs = historyFilterBabs.length > 0
              ? historyForSelectedMapels.filter(h => h.bab === 'Semua BAB' || splitCategory(h.bab).some(b => historyFilterBabs.includes(b)))
              : [];
            const historyMapelOptions = mapels.map(m => ({ label: m.replace(/_/g, ' '), value: m }));
            const historyBabOptions = historyFilterMapels.length === 0 ? [] : Array.from(new Set(historyForSelectedMapels.flatMap(h => splitCategory(h.bab)).filter(b => b !== 'Semua BAB')))
              .sort()
              .map(b => ({ label: b.replace(/_/g, ' '), value: b }));
            const historySubBabOptions = historyFilterBabs.length === 0 ? [] : Array.from(new Set(historyForSelectedBabs.flatMap(h => splitCategory(h.sub_bab)).filter(sb => sb !== 'Semua Sub-bab')))
              .sort()
              .map(sb => ({ label: sb.replace(/_/g, ' '), value: sb }));

            return (
              <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
                <div className={`shrink-0 rounded-[24px] border p-5 shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-[#e5e5e5] bg-white'}`}>
                  <div className="mb-3">
                    <h3 className={`text-sm font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Quiz history</h3>
                    <p className={`mt-0.5 text-xs font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-[#707072]'}`}>Filter by topic to inspect completed sessions.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <span className={`block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Mapel</span>
                      <MultiSelectDropdown
                        label="Mapel"
                        options={historyMapelOptions}
                        selectedValues={historyFilterMapels}
                        onChange={(values) => {
                          setHistoryFilterMapels(values);
                          setHistoryFilterBabs([]);
                          setHistoryFilterSubBabs([]);
                          setHistoryPage(1);
                        }}
                        placeholder="None Selected"
                        theme={theme}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className={`block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Bab</span>
                      <MultiSelectDropdown
                        label="Bab"
                        options={historyBabOptions}
                        selectedValues={historyFilterBabs}
                        onChange={(values) => {
                          setHistoryFilterBabs(values);
                          setHistoryFilterSubBabs([]);
                          setHistoryPage(1);
                        }}
                        placeholder={historyFilterMapels.length === 0 ? 'Pilih Mapel dulu' : 'None Selected'}
                        theme={theme}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className={`block text-[11px] font-semibold ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Sub-bab</span>
                      <MultiSelectDropdown
                        label="Sub-bab"
                        options={historySubBabOptions}
                        selectedValues={historyFilterSubBabs}
                        onChange={(values) => {
                          setHistoryFilterSubBabs(values);
                          setHistoryPage(1);
                        }}
                        placeholder={historyFilterBabs.length === 0 ? 'Pilih Bab dulu' : 'None Selected'}
                        theme={theme}
                      />
                    </div>
                  </div>
                </div>

                <div className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border shadow-ios-sm ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-800' : 'border-[#e5e5e5] bg-white'}`}>
                  {filteredHistory.length > 0 && (
                    <div className={`mx-3 mt-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 sm:mx-6 ${theme === 'dark' ? 'border-dark-border-subtle bg-white/[0.03]' : 'border-[#E5E5E5] bg-black/[0.02]'}`}>
                      <div className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-[#707072]'}`}>
                        Showing {filteredHistory.length === 0 ? 0 : ((historyPage - 1) * historyItemsPerPage) + 1}-{Math.min(historyPage * historyItemsPerPage, filteredHistory.length)} of {filteredHistory.length}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={historyItemsPerPage}
                          onChange={(event) => {
                            setHistoryItemsPerPage(Number(event.target.value));
                            setHistoryPage(1);
                          }}
                          className={`h-8 rounded-full border px-3 text-[11px] font-semibold focus:outline-none ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue' : 'border-[#CACACB] bg-white text-[#111111] focus:border-[#111111]'}`}
                        >
                          {[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                        </select>
                        <div className={`flex h-8 overflow-hidden rounded-full border ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750' : 'border-[#CACACB] bg-white'}`}>
                          <button type="button" onClick={() => setHistoryPage(Math.max(1, historyPage - 1))} disabled={historyPage === 1} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>Prev</button>
                          <span className={`flex items-center border-x px-3 text-[11px] font-semibold ${theme === 'dark' ? 'border-dark-border-medium text-dark-text-tertiary' : 'border-[#E5E5E5] text-[#707072]'}`}>{historyPage}/{Math.ceil(filteredHistory.length / historyItemsPerPage)}</span>
                          <button type="button" onClick={() => setHistoryPage(Math.min(Math.ceil(filteredHistory.length / historyItemsPerPage), historyPage + 1))} disabled={historyPage === Math.ceil(filteredHistory.length / historyItemsPerPage)} className={`px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'}`}>Next</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-auto">
                    <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-dark-border-subtle' : 'divide-[#f0f0f0]'}`}>
                      <thead className={theme === 'dark' ? 'bg-white/[0.02]' : 'bg-[#f8f8f8]'}>
                        <tr>
                          <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Join code</th>
                          <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Topik</th>
                          <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Players</th>
                          <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Winner</th>
                          <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Top score</th>
                          <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Date</th>
                          <th className={`px-4 py-3 text-left text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Status</th>
                          <th className={`px-4 py-3 text-right text-[11px] font-semibold sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Action</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme === 'dark' ? 'divide-dark-border-subtle bg-dark-800' : 'divide-[#f0f0f0] bg-white'}`}>
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={8} className={`px-4 py-10 text-center text-sm font-medium sm:px-6 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>No history found.</td>
                          </tr>
                        ) : filteredHistory.slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage).map(h => (
                          <tr key={h.id} className={theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}>
                            <td className={`whitespace-nowrap px-4 py-3 font-mono text-sm sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                              <span className="block max-w-[140px] truncate" title={h.quiz_code}>{h.quiz_code}</span>
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-sm capitalize sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
                              <span
                                className="block max-w-[220px] truncate"
                                title={`${h.mapel?.replace(/_/g, ' ')} - ${h.bab?.replace(/_/g, ' ')} - ${h.sub_bab?.replace(/_/g, ' ')}`}
                              >
                                {h.mapel?.replace(/_/g, ' ')} - {h.bab?.replace(/_/g, ' ')} - {h.sub_bab?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-sm font-medium tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>{h.player_count}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-sm font-semibold sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                              <span className="block max-w-[180px] truncate" title={h.winner}>{h.winner}</span>
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-sm font-semibold tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-accent-green' : 'text-green-600'}`}>{h.top_score} / {h.question_count}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums sm:px-6 sm:py-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{new Date(h.created_at).toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6 sm:py-4">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${theme === 'dark' ? 'bg-white/[0.05] text-dark-text-secondary' : 'bg-black/[0.04] text-gray-700'}`}>{h.status}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium sm:px-6 sm:py-4">
                              <button onClick={() => setActiveSession(h)} className={`h-8 rounded-full px-3.5 text-[11px] font-semibold transition-spring-fast hover:scale-[1.02] ${theme === 'dark' ? 'bg-accent-purple/15 text-accent-purple hover:bg-accent-purple/25' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[10000]" onClick={() => setViewingPlayer(null)}>
          <div className={`rounded-[28px] shadow-ios-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={`shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b sm:gap-4 sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
              <div className="flex flex-col gap-2 min-w-0">
                <h2 className={`text-[15px] font-semibold tracking-tight truncate ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                  {viewingPlayer.name}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${viewingPlayer.finished_at ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700') : (theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange' : 'bg-orange-50 text-orange-700')}`}>
                    {viewingPlayer.finished_at ? 'Finished' : 'Playing'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`} title={formatCategorySelectionLabel(activeSession?.mapel)}>
                    {formatCategorySelectionLabel(activeSession?.mapel)}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`} title={formatCategorySelectionLabel(activeSession?.bab)}>
                    {formatCategorySelectionLabel(activeSession?.bab)}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`} title={formatCategorySelectionLabel(activeSession?.sub_bab)}>
                    {formatCategorySelectionLabel(activeSession?.sub_bab)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingPlayer(null)}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 ${theme === 'dark' ? 'result-details-scroll-dark' : 'result-details-scroll-light'}`}>
              {loadingAnswers ? (
                <div className={`text-center py-20 text-[12px] font-medium animate-pulse ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
                  Loading answers...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
                        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                          {activeSession?.question_count || 0}
                        </p>
                        <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                          Total
                        </p>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
                        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-accent-green' : 'text-green-700'}`}>
                          {viewingPlayer.score}
                        </p>
                        <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>
                          Correct
                        </p>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-red/10' : 'bg-red-50'}`}>
                        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-accent-red' : 'text-red-700'}`}>
                          {(activeSession?.question_count || 0) - viewingPlayer.score}
                        </p>
                        <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-red/80' : 'text-red-600'}`}>
                          Incorrect
                        </p>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-blue/10' : 'bg-blue-50'}`}>
                        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${theme === 'dark' ? 'text-accent-blue' : 'text-blue-700'}`}>
                          {activeSession?.question_count ? Math.round((viewingPlayer.score / activeSession.question_count) * 100) : 0}%
                        </p>
                        <p className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-blue/80' : 'text-blue-600'}`}>
                          Score
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
                      <span className={`text-[12px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                        Time spent
                      </span>
                      <span className={`text-[13px] font-semibold tabular-nums font-mono ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                        {formatHMS(viewingPlayer.total_time)}
                      </span>
                    </div>
                  </div>

                  {/* Questions Accordion */}
                  <div className="space-y-2">
                    {(() => {
                      const allIds = viewingPlayer.question_ids || activeSession?.question_ids || [];
                      const answeredIds = playerAnswers.map(a => a.question_id);
                      const orderedIds = [...allIds, ...answeredIds.filter(id => !allIds.includes(id))];

                      const toggleQuestion = (questionId: number) => {
                        setExpandedPlayerQuestions(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(questionId)) {
                            newSet.delete(questionId);
                          } else {
                            newSet.add(questionId);
                          }
                          return newSet;
                        });
                      };

                      return orderedIds.map((qId, idx) => {
                        const question = sessionQuestions.find(q => q.id === qId);
                        const answer = playerAnswers.find(a => a.question_id === qId);
                        if (!question) return null;

                        const isExpanded = expandedPlayerQuestions.has(qId);
                        const isShortAnswer = question.question_type === 'short_answer';
                        const correctText = isShortAnswer ? question.short_answer : getQuestionOptionText(question, question.correct_answer);

                        return (
                          <div key={`${qId}-${idx}`} className={`rounded-2xl overflow-hidden transition-spring-fast ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
                            <button
                              onClick={() => toggleQuestion(qId)}
                              className={`w-full px-4 py-3 flex items-center justify-between gap-3 transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`text-[12px] font-semibold tabular-nums shrink-0 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
                                  Q{idx + 1}
                                </span>
                                {answer ? (
                                  <span className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${answer.is_correct ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700') : (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700')}`}>
                                    <span className="text-[14px] leading-none">{answer.is_correct ? '✓' : '✗'}</span>
                                    {answer.is_correct ? 'Correct' : 'Incorrect'}
                                  </span>
                                ) : (
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight ${theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-400'}`}>
                                    Not answered
                                  </span>
                                )}
                              </div>
                              <svg
                                className={`w-4 h-4 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {isExpanded && (
                              <div className={`px-4 pb-4 space-y-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
                                <div className="pt-4">
                                  <p className={`text-[11px] font-medium mb-2 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                                    Question
                                  </p>
                                  <RichContent html={question.question_text} className={`text-[13px] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`} />
                                </div>

                                {answer && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className={`rounded-2xl px-4 py-3 ${answer.is_correct ? (theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50') : (theme === 'dark' ? 'bg-accent-red/10' : 'bg-red-50')}`}>
                                      <p className={`text-[11px] font-medium mb-1.5 ${answer.is_correct ? (theme === 'dark' ? 'text-accent-green/80' : 'text-green-600') : (theme === 'dark' ? 'text-accent-red/80' : 'text-red-600')}`}>
                                        User answer
                                      </p>
                                      <RichContent html={answer.user_answer} className={`text-[13px] font-medium ${answer.is_correct ? (theme === 'dark' ? 'text-accent-green' : 'text-green-800') : (theme === 'dark' ? 'text-accent-red' : 'text-red-800')}`} />
                                      <p className={`text-[11px] font-mono tabular-nums mt-2 ${answer.is_correct ? (theme === 'dark' ? 'text-accent-green/70' : 'text-green-600/80') : (theme === 'dark' ? 'text-accent-red/70' : 'text-red-600/80')}`}>
                                        {formatHMS(answer.time_taken)}
                                      </p>
                                    </div>

                                    {!answer.is_correct && (
                                      <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
                                        <p className={`text-[11px] font-medium mb-1.5 ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>
                                          Correct answer{isShortAnswer ? '' : ` (${question.correct_answer})`}
                                        </p>
                                        <RichContent html={correctText} className={`text-[13px] font-medium ${theme === 'dark' ? 'text-accent-green' : 'text-green-800'}`} />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Questions Modal */}
      {showViewQuestions && activeSession && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[10000]" onClick={() => setShowViewQuestions(false)}>
          <div className={`rounded-[28px] shadow-ios-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={`shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b sm:gap-4 sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
              <div className="flex flex-col gap-2 min-w-0">
                <h2 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                  Question analytics
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                    {activeSession.question_count} questions
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                    {players.length} players
                  </span>
                  <button
                    onClick={() => setShowAllAnswers(!showAllAnswers)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-spring-fast active:scale-95 ${showAllAnswers
                      ? (theme === 'dark' ? 'bg-accent-purple/15 text-accent-purple' : 'bg-indigo-50 text-indigo-700')
                      : (theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10')
                      }`}
                  >
                    {showAllAnswers ? 'Hide answers' : 'Show answers'}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowViewQuestions(false)}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 ${theme === 'dark' ? 'result-details-scroll-dark' : 'result-details-scroll-light'}`}>
              {loadingAllAnswers ? (
                <div className={`text-center py-20 text-[12px] font-medium animate-pulse ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
                  Loading question data…
                </div>
              ) : (
                <div className="space-y-2">
                  {(activeSession.question_ids || []).map((qId, idx) => {
                    const question = sessionQuestions.find(q => q.id === qId);
                    if (!question) return null;

                    const isShortAnswer = question.question_type === 'short_answer';
                    const correctLabel = question.correct_answer;
                    const correctOptionText = isShortAnswer
                      ? question.short_answer
                      : getQuestionOptionText(question, correctLabel);
                    const correctAnswers = allPlayerAnswers.filter(a => a.question_id === qId && a.is_correct);
                    const totalAnswers = allPlayerAnswers.filter(a => a.question_id === qId);
                    const correctPlayerNames = correctAnswers.map(a => {
                      const player = players.find(p => p.id === a.player_id);
                      return player?.name || 'Unknown';
                    });
                    const isAllCorrect = correctAnswers.length > 0 && correctAnswers.length === totalAnswers.length;
                    const isAllWrong = totalAnswers.length > 0 && correctAnswers.length === 0;
                    const statusBg = isAllCorrect ? (theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700')
                      : isAllWrong ? (theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700')
                      : (theme === 'dark' ? 'bg-accent-orange/15 text-accent-orange' : 'bg-orange-50 text-orange-700');

                    return (
                      <div key={qId} className={`rounded-2xl overflow-hidden ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
                        <div className={`flex items-center justify-between gap-3 px-4 py-3`}>
                          <span className={`text-[12px] font-semibold tabular-nums ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Q{idx + 1}</span>
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight tabular-nums ${statusBg}`}>
                            {correctAnswers.length}/{totalAnswers.length} benar
                          </span>
                        </div>
                        <div className={`px-4 pb-4 space-y-3 border-t ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
                          <div className="pt-3">
                            <p className={`text-[11px] font-medium mb-2 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                              Question
                            </p>
                            <RichContent html={question.question_text} className={`text-[13px] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`} />
                          </div>

                          {/* Correct Answer */}
                          {showAllAnswers && (
                            <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-accent-green/10' : 'bg-green-50'}`}>
                              <p className={`text-[11px] font-medium mb-1.5 ${theme === 'dark' ? 'text-accent-green/80' : 'text-green-600'}`}>Jawaban benar</p>
                              <RichContent html={correctOptionText} className={`text-[13px] font-medium ${theme === 'dark' ? 'text-accent-green' : 'text-green-800'}`} />
                            </div>
                          )}

                          {/* Who answered correctly */}
                          <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.025]' : 'bg-black/[0.02]'}`}>
                            <p className={`text-[11px] font-medium mb-2 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                              Pemain benar · {correctAnswers.length}
                            </p>
                            {correctPlayerNames.length === 0 ? (
                              <p className={`text-[12px] italic ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Belum ada</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {correctPlayerNames.map((name, i) => (
                                  <span key={i} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-accent-green/15 text-accent-green' : 'bg-green-50 text-green-700'}`}>
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Who answered incorrectly */}
                          {(() => {
                            const incorrectAnswers = allPlayerAnswers.filter(a => a.question_id === qId && !a.is_correct);
                            const incorrectPlayerNames = incorrectAnswers.map(a => {
                              const player = players.find(p => p.id === a.player_id);
                              return player?.name || 'Unknown';
                            });

                            return (
                              <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.025]' : 'bg-black/[0.02]'}`}>
                                <p className={`text-[11px] font-medium mb-2 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
                                  Pemain salah · {incorrectAnswers.length}
                                </p>
                                {incorrectPlayerNames.length === 0 ? (
                                  <p className={`text-[12px] italic ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Belum ada</p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {incorrectPlayerNames.map((name, i) => (
                                      <span key={i} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700'}`}>
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* End Quiz Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[10000]" onClick={() => setShowEndConfirm(false)}>
          <div className={`rounded-[24px] max-w-sm w-full p-6 shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-500'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className={`text-[15px] font-semibold tracking-tight mb-1.5 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Akhiri quiz?</h3>
            <p className={`text-[13px] leading-relaxed mb-5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Apakah anda yakin menyelesaikan quiz sekarang?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEndConfirm(false)}
                className={`flex-1 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  handleStatusChange('finished');
                }}
                className={`flex-1 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-red-500 hover:bg-red-600'}`}
              >
                Akhiri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Quiz Confirmation Modal */}
      {showCancelConfirm && activeSession && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-4 z-[10000]" onClick={() => setShowCancelConfirm(false)}>
          <div className={`rounded-[24px] max-w-sm w-full p-6 shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-500'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className={`text-[15px] font-semibold tracking-tight mb-1.5 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Batalkan quiz?</h3>
            <p className={`text-[13px] leading-relaxed mb-5 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Semua data pemain dan jawaban akan dihapus secara permanen.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className={`flex-1 h-9 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  setShowCancelConfirm(false);
                  const ok = await deleteQuizSession(activeSession.id);
                  if (ok) {
                    handleCloseSession();
                    setActiveView('manage');
                  } else {
                    alert('Gagal membatalkan kuis.');
                  }
                }}
                className={`flex-1 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-red-500 hover:bg-red-600'}`}
              >
                Ya, batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {createErrorModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-2xl px-4">
          <div className={`w-full max-w-md rounded-[24px] p-6 shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800 text-dark-text-primary' : 'bg-white text-gray-900'}`}>
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-600'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight">Kuis tidak bisa dibuat</h3>
                <p className={`text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Jumlah soal tidak mencukupi</p>
              </div>
            </div>

            <div className={`mb-4 rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
              <div className="mb-1.5 flex justify-between items-center gap-4">
                <span className={`text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Soal tersedia</span>
                <span className={`text-[13px] font-semibold tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{createErrorModal.availableCount}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className={`text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Soal diminta</span>
                <span className={`text-[13px] font-semibold tabular-nums ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{createErrorModal.requestedCount}</span>
              </div>
            </div>

            <p className={`mb-4 text-[12px] leading-relaxed ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
              Filter saat ini hanya menemukan {createErrorModal.availableCount} soal. Tambah soal pada topik ini, kurangi jumlah soal, atau pilih topik lain.
            </p>

            <button
              type="button"
              onClick={() => setCreateErrorModal(null)}
              className={`w-full h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} theme={theme} />
    </div>
  );
}

function Pagination({ totalItems, itemsPerPage, currentPage, onPageChange, theme = 'dark' }: { totalItems: number, itemsPerPage: number, currentPage: number, onPageChange: (page: number) => void, theme?: 'light' | 'dark' }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className={`flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 ${theme === 'dark' ? 'bg-dark-750 border-dark-border' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-700 text-dark-text-primary hover:bg-dark-600' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-700 text-dark-text-primary hover:bg-dark-600' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className={`text-sm ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>
            Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-700 text-dark-text-secondary hover:bg-dark-600' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}`}
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
                  ? (theme === 'dark' ? 'z-10 bg-accent-purple/20 border-accent-purple text-accent-purple' : 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600')
                  : (theme === 'dark' ? 'bg-dark-700 border-dark-border text-dark-text-secondary hover:bg-dark-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50')
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-700 text-dark-text-secondary hover:bg-dark-600' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}`}
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
