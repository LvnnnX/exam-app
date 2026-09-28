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

// Shared class recipes for this tab (see DESIGN.md: well, clay, glass).
const ui = {
  fieldLabel: 'mb-1.5 block text-[13px] font-semibold text-fg',
  hint: 'mt-1.5 text-[12px] text-fg-muted',
  select: 'well well-hover h-11 w-full cursor-pointer rounded-xl px-3 text-[14px] font-medium text-fg transition-calm',
  input: 'well h-11 w-full min-w-0 max-w-full rounded-xl px-3 text-[14px] font-medium text-fg transition-calm',
  secondary: 'well well-hover flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm disabled:cursor-not-allowed disabled:opacity-50',
  segment: (active: boolean) => `h-11 md:h-10 flex-1 rounded-lg px-3 text-[13px] font-semibold transition-calm ${active ? 'clay' : 'text-fg-muted hover:text-fg'}`,
  trigger: (disabled: boolean) => `well flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left transition-calm ${disabled ? 'cursor-not-allowed opacity-60' : 'well-hover cursor-pointer'}`,
  panel: 'glass-strong animate-in absolute z-20 mt-1.5 max-h-[280px] w-full overflow-y-auto rounded-2xl p-1.5',
  option: 'well-hover flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left transition-calm',
  check: (checked: boolean) => `flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md ${checked ? 'bg-primary text-on-primary' : 'border border-line-strong'}`,
  selectedChip: 'inline-flex items-center gap-1 rounded-md bg-primary/12 py-0.5 pl-2 pr-0.5 text-[12px] font-semibold text-primary',
  chipRemove: 'flex h-6 w-6 items-center justify-center rounded text-primary hover:bg-primary/15',
  switchTrack: (on: boolean) => `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-calm ${on ? 'bg-primary' : 'bg-line-strong'}`,
  switchKnob: (on: boolean) => `inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`,
  section: 'border-t border-line p-4 md:p-5',
  modalShell: 'glass-sheet animate-in w-full rounded-4xl',
  iconClose: 'well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm',
};

function CheckMark() {
  return (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function onTriggerKey(event: React.KeyboardEvent<HTMLDivElement>, toggle: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggle();
  }
}

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

  // Escape closes the topmost open overlay, in stacking order. The race view
  // listens for Escape itself, so this handler steps aside while it is open.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || showLeaderboardView) return;
      if (createErrorModal) setCreateErrorModal(null);
      else if (showEndConfirm) setShowEndConfirm(false);
      else if (showCancelConfirm) setShowCancelConfirm(false);
      else if (editingSchedule) setEditingSchedule(false);
      else if (viewingPlayer) setViewingPlayer(null);
      else if (showViewQuestions) setShowViewQuestions(false);
      else if (activeSession) handleCloseSession();
      else if (isMapelOpen || isBabOpen || isSubBabOpen) {
        setIsMapelOpen(false);
        setIsBabOpen(false);
        setIsSubBabOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showLeaderboardView, createErrorModal, showEndConfirm, showCancelConfirm, editingSchedule,
    viewingPlayer, showViewQuestions, activeSession, handleCloseSession, isMapelOpen, isBabOpen, isSubBabOpen,
  ]);

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
  }, [activeSession?.id, activeSession?.status]);

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
  }, [activeSession, activeSession?.id, activeSession?.status, activeSession?.scheduled_at, currentTime, deleteQuizSession, updateQuizStatus]);

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
        // Silently ignore sync failures; use local time as fallback
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
    <div data-theme={theme} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="glass mb-3 shrink-0 rounded-3xl px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[200px] flex-1">
            <h2 className="text-[22px] font-bold tracking-tight text-fg">Quiz</h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              {activeSession ? 'Pantau sesi quiz, pemain, dan leaderboard secara live.' : activeView === 'history' ? 'Review riwayat quiz yang sudah selesai.' : activeView === 'manage' ? 'Kelola sesi quiz aktif, waiting, dan paused.' : 'Buat sesi quiz live dari topik pilihan.'}
            </p>
          </div>
          {(activeView !== 'create' || activeSession) && (
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className={ui.secondary}
            >
              {refreshing && <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />}
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
        <div className="mt-4">
          <div className="well inline-flex gap-1 rounded-xl p-1" role="group" aria-label="Quiz view">
            {(['create', 'manage', 'history'] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={activeView === view}
                onClick={() => setActiveView(view)}
                className={`h-11 md:h-10 rounded-lg px-4 text-[13px] font-semibold capitalize transition-calm ${activeView === view ? 'clay' : 'text-fg-muted hover:text-fg'}`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeView === 'create' && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mx-auto max-w-2xl py-1 md:py-2">
          {/* Form Card */}
          <div className="glass rounded-3xl">
            <div className="flex items-center gap-3 px-4 pt-4 md:px-5 md:pt-5">
              <span className="clay flex h-11 w-11 items-center justify-center rounded-xl text-[16px] font-bold" aria-hidden="true">Q</span>
              <div>
                <h3 className="text-[17px] font-bold tracking-tight text-fg">Buat kuis baru</h3>
                <p className="text-[13px] text-fg-muted">Sesi kuis live dari topik pilihan.</p>
              </div>
            </div>

            {/* MAPEL & BAB & Sub-bab */}
            <div className="flex flex-col gap-3 p-4 md:flex-row md:p-5">
              <div className="flex-1">
                <span className={ui.fieldLabel}>Mapel</span>
                <div className="relative">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-haspopup="listbox"
                    aria-expanded={isMapelOpen}
                    aria-label="Mapel"
                    onClick={() => setIsMapelOpen(!isMapelOpen)}
                    onKeyDown={(event) => onTriggerKey(event, () => setIsMapelOpen(!isMapelOpen))}
                    className={ui.trigger(false)}
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedMapels.length === 0 ? (
                        <span className="text-[14px] font-medium text-fg-subtle">None selected</span>
                      ) : (
                        selectedMapels.map(m => (
                          <span key={m} className={ui.selectedChip}>
                            {m}
                            <button type="button" aria-label={`Remove ${m}`} onClick={(e) => {
                              e.stopPropagation();
                              const next = selectedMapels.filter(v => v !== m);
                              setSelectedMapels(next);
                              setSelectedBabs([]);
                              setSelectedSubBabs([]);
                            }} className={ui.chipRemove}>&times;</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform ${isMapelOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isMapelOpen && (
                    <div className={ui.panel} role="listbox" aria-multiselectable="true">
                      <button
                        type="button"
                        className={ui.option}
                        onClick={() => {
                          setSelectedMapels([]);
                          setSelectedBabs([]);
                          setSelectedSubBabs([]);
                          setIsMapelOpen(false);
                        }}
                      >
                        <span className={ui.check(selectedMapels.length === 0)}>
                          {selectedMapels.length === 0 && <CheckMark />}
                        </span>
                        <span className="text-[14px] font-medium text-fg-muted">None selected</span>
                      </button>
                      {mapels.map(m => {
                        const isSelected = selectedMapels.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={ui.option}
                            onClick={() => {
                              const next = isSelected ? selectedMapels.filter(v => v !== m) : [...selectedMapels, m];
                              setSelectedMapels(next);
                              setSelectedBabs([]);
                              setSelectedSubBabs([]);
                            }}
                          >
                            <span className={ui.check(isSelected)}>
                              {isSelected && <CheckMark />}
                            </span>
                            <span className={`text-[14px] font-medium ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>{m}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <span className={ui.fieldLabel}>Bab</span>
                <div className="relative">
                  <div
                    role="button"
                    tabIndex={selectedMapels.length === 0 ? -1 : 0}
                    aria-haspopup="listbox"
                    aria-expanded={isBabOpen}
                    aria-disabled={selectedMapels.length === 0}
                    aria-label="Bab"
                    onClick={() => {
                      if (selectedMapels.length === 0) return;
                      setIsBabOpen(!isBabOpen);
                    }}
                    onKeyDown={(event) => onTriggerKey(event, () => {
                      if (selectedMapels.length === 0) return;
                      setIsBabOpen(!isBabOpen);
                    })}
                    className={ui.trigger(selectedMapels.length === 0)}
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedBabs.length === 0 ? (
                        <span className="text-[14px] font-medium text-fg-subtle">None selected</span>
                      ) : (
                        selectedBabs.map(b => (
                          <span key={b} className={ui.selectedChip}>
                            {b}
                            <button type="button" aria-label={`Remove ${b}`} onClick={(e) => {
                              e.stopPropagation();
                              const next = selectedBabs.filter(v => v !== b);
                              setSelectedBabs(next);
                              setSelectedSubBabs([]);
                            }} className={ui.chipRemove}>&times;</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform ${isBabOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isBabOpen && (
                    <div className={ui.panel} role="listbox" aria-multiselectable="true">
                      <button
                        type="button"
                        className={ui.option}
                        onClick={() => {
                          setSelectedBabs([]);
                          setSelectedSubBabs([]);
                          setIsBabOpen(false);
                        }}
                      >
                        <span className={ui.check(selectedBabs.length === 0)}>
                          {selectedBabs.length === 0 && <CheckMark />}
                        </span>
                        <span className="text-[14px] font-medium text-fg-muted">None selected</span>
                      </button>
                      {selectedMapels.length === 0 ? (
                        <div className="p-3 text-center text-[13px] text-fg-muted">Pilih MAPEL terlebih dahulu</div>
                      ) : loadingBabs ? (
                        <div className="flex items-center justify-center gap-2 p-3 text-[13px] text-fg-muted"><span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />Loading BAB...</div>
                      ) : displayBabs.length > 0 ? (
                        displayBabs.map(b => {
                          const isSelected = selectedBabs.includes(b);
                          return (
                            <button
                              key={b}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={ui.option}
                              onClick={() => {
                                const next = isSelected ? selectedBabs.filter(v => v !== b) : [...selectedBabs, b];
                                setSelectedBabs(next);
                                setSelectedSubBabs([]);
                              }}
                            >
                              <span className={ui.check(isSelected)}>
                                {isSelected && <CheckMark />}
                              </span>
                              <span className={`text-[14px] font-medium ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>{b}</span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-[13px] text-fg-muted">No BAB found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <span className={ui.fieldLabel}>Sub-bab</span>
                <div className="relative">
                  <div
                    role="button"
                    tabIndex={selectedBabs.length === 0 ? -1 : 0}
                    aria-haspopup="listbox"
                    aria-expanded={isSubBabOpen}
                    aria-disabled={selectedBabs.length === 0}
                    aria-label="Sub-bab"
                    onClick={() => {
                      if (selectedBabs.length === 0) return;
                      setIsSubBabOpen(!isSubBabOpen);
                    }}
                    onKeyDown={(event) => onTriggerKey(event, () => {
                      if (selectedBabs.length === 0) return;
                      setIsSubBabOpen(!isSubBabOpen);
                    })}
                    className={ui.trigger(selectedBabs.length === 0)}
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedSubBabs.length === 0 ? (
                        <span className="text-[14px] font-medium text-fg-subtle">None selected</span>
                      ) : (
                        selectedSubBabs.map(v => {
                          const label = displaySubBabs.find(d => d.value === v)?.label || v;
                          return (
                            <span key={v} className={ui.selectedChip}>
                              {label}
                              <button type="button" aria-label={`Remove ${label}`} onClick={(e) => {
                                e.stopPropagation();
                                const next = selectedSubBabs.filter(s => s !== v);
                                setSelectedSubBabs(next);
                                const newPct = { ...subBabPercentages };
                                delete newPct[v];
                                setSubBabPercentages(newPct);
                              }} className={ui.chipRemove}>&times;</button>
                            </span>
                          );
                        })
                      )}
                    </div>
                    <svg className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform ${isSubBabOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isSubBabOpen && (
                    <div className={ui.panel} role="listbox" aria-multiselectable="true">
                      <button
                        type="button"
                        className={ui.option}
                        onClick={() => {
                          setSelectedSubBabs([]);
                          setSubBabPercentages({});
                          setIsSubBabOpen(false);
                        }}
                      >
                        <span className={ui.check(selectedSubBabs.length === 0)}>
                          {selectedSubBabs.length === 0 && <CheckMark />}
                        </span>
                        <span className="text-[14px] font-medium text-fg-muted">None selected</span>
                      </button>

                      {selectedBabs.length === 0 ? (
                        <div className="p-3 text-center text-[13px] text-fg-muted">Pilih BAB terlebih dahulu</div>
                      ) : loadingSubBabs ? (
                        <div className="flex items-center justify-center gap-2 p-3 text-[13px] text-fg-muted"><span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />Loading...</div>
                      ) : displaySubBabs.length > 0 ? (
                        displaySubBabs.map(sb => {
                          const isSelected = selectedSubBabs.includes(sb.value);
                          return (
                            <button
                              key={sb.value}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={ui.option}
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
                              <span className={ui.check(isSelected)}>
                                {isSelected && <CheckMark />}
                              </span>
                              <span className={`text-[14px] font-medium ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>{sb.label}</span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-[13px] text-fg-muted">No Sub-bab found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Question Count & Duration - Side by Side */}
            <div className={ui.section}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="quiz-question-count" className={ui.fieldLabel}>Jumlah soal</label>
                  <select
                    id="quiz-question-count"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className={ui.select}
                  >
                    {[5, 10, 20, 25, 30, 40, 50, 100].map(n => (
                      <option key={n} value={n}>{n} soal</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="quiz-duration" className={ui.fieldLabel}>Durasi waktu</label>
                  <select
                    id="quiz-duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                    className={ui.select}
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
                <div className={ui.section}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span id="quiz-percentage-label" className="block text-[13px] font-semibold text-fg">Persentase soal</span>
                      <span className="block text-[12px] text-fg-muted">Atur porsi soal per sub-bab.</span>
                    </div>
                    <button
                      type="button"
                      aria-labelledby="quiz-percentage-label"
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
                      className="flex h-11 items-center"
                      role="switch"
                      aria-checked={percentagesEnabled}
                    >
                      <span className={ui.switchTrack(percentagesEnabled)}>
                        <span aria-hidden="true" className={ui.switchKnob(percentagesEnabled)} />
                      </span>
                    </button>
                  </div>
                  {percentagesEnabled && (
                    <div className="well mt-3 space-y-2 rounded-2xl p-3">
                      {effectiveSubBabs.map(sub => {
                        const label = displaySubBabs.find(d => d.value === sub)?.label || sub;
                        return (
                          <div key={sub} className="flex items-center justify-between gap-3">
                            <span className="flex-1 truncate text-[13px] font-medium text-fg">{label}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                aria-label={`Persentase ${label}`}
                                value={subBabPercentages[sub] || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setSubBabPercentages(prev => ({ ...prev, [sub]: val }));
                                }}
                                className="h-11 md:h-10 w-16 rounded-lg border border-line-strong bg-transparent text-center text-[14px] font-semibold tabular-nums text-fg transition-calm"
                              />
                              <span className="text-[13px] font-semibold text-fg-muted">%</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="mt-1.5 flex items-center justify-between border-t border-line pt-2">
                        <button
                          type="button"
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
                          className="flex h-11 md:h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/10"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reset
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-fg-muted">Total</span>
                          <span className={`text-[14px] font-bold tabular-nums ${effectiveSubBabs.reduce((a, b) => a + (subBabPercentages[b] || 0), 0) === 100 ? 'text-primary' : 'text-danger'}`}>
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
            <div className={ui.section}>
              <span className={ui.fieldLabel}>Mode navigasi</span>
              <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Mode navigasi">
                <button
                  type="button"
                  aria-pressed={quizMode === 'strict'}
                  onClick={() => setQuizMode('strict')}
                  className={ui.segment(quizMode === 'strict')}
                >
                  Strict
                </button>
                <button
                  type="button"
                  aria-pressed={quizMode === 'standard'}
                  onClick={() => setQuizMode('standard')}
                  className={ui.segment(quizMode === 'standard')}
                >
                  Standard
                </button>
              </div>
              <p className={ui.hint}>
                {quizMode === 'strict' ? 'Soal harus dikerjakan berurutan, tidak bisa kembali.' : 'Peserta bisa bolak-balik soal dan menandai ragu-ragu.'}
              </p>
            </div>

            {/* Allow Join Mid Game */}
            <div className={ui.section}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span id="quiz-join-mid-label" className="block text-[13px] font-semibold text-fg">Masuk tengah ujian</span>
                  <span className={`block text-[12px] font-semibold ${allowJoinMidGame ? 'text-primary' : 'text-fg-muted'}`}>
                    {allowJoinMidGame ? 'Diizinkan' : 'Dilarang'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowJoinMidGame}
                  aria-labelledby="quiz-join-mid-label"
                  onClick={() => setAllowJoinMidGame(!allowJoinMidGame)}
                  className="flex h-11 items-center"
                >
                  <span className={ui.switchTrack(allowJoinMidGame)}>
                    <span className={ui.switchKnob(allowJoinMidGame)} />
                  </span>
                </button>
              </div>
              <p className={ui.hint}>
                {allowJoinMidGame
                  ? 'Peserta baru bisa bergabung meskipun kuis sudah dimulai.'
                  : 'Peserta baru tidak bisa bergabung jika kuis sudah dimulai.'}
              </p>
            </div>

            {/* Schedule */}
            <div className={ui.section}>
              <div className="flex items-center justify-between gap-3">
                <span id="quiz-schedule-label" className="text-[13px] font-semibold text-fg">Schedule quiz</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={scheduleEnabled}
                  aria-labelledby="quiz-schedule-label"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className="flex h-11 items-center"
                >
                  <span className={ui.switchTrack(scheduleEnabled)}>
                    <span className={ui.switchKnob(scheduleEnabled)} />
                  </span>
                </button>
              </div>
              {scheduleEnabled && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1">
                    <label htmlFor="quiz-schedule-date" className="mb-1 block text-[12px] font-medium text-fg-muted">Tanggal</label>
                    <input
                      id="quiz-schedule-date"
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
                      className={ui.input}
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="quiz-schedule-time" className="mb-1 block text-[12px] font-medium text-fg-muted">Waktu</label>
                    <input
                      id="quiz-schedule-time"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      min={scheduleDate === nowDateInput ? nowTimeInput : undefined}
                      className={ui.input}
                    />
                  </div>
                </div>
              )}
              {scheduleEnabled && scheduleDate && scheduleTime && (
                <p className="mt-2 text-[13px] font-medium text-primary">
                  Mulai otomatis: {new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className={ui.section}>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || selectedMapels.length === 0 || selectedBabs.length === 0 || selectedSubBabs.length === 0}
                className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner-calm h-4 w-4" aria-hidden="true" />
                    Creating...
                  </span>
                ) : selectedMapels.length === 0 ? (
                  'Pilih MAPEL dulu'
                ) : selectedBabs.length === 0 ? (
                  'Pilih BAB dulu'
                ) : selectedSubBabs.length === 0 ? (
                  'Pilih Sub-bab dulu'
                ) : (
                  'Buat kuis'
                )}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {activeSession && (
        <div className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4" onClick={handleCloseSession}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-details-title"
            className="glass-sheet animate-in flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-4xl text-fg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3 sm:px-7 sm:py-4">
              <h2 id="session-details-title" className="text-[18px] font-bold tracking-tight text-fg">Session details</h2>
              <button type="button" onClick={handleCloseSession} aria-label="Close" className={ui.iconClose}>
                <CloseGlyph />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-7">

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-[12px] font-medium text-fg-muted">Join code</p>
                <p className="clay inline-flex rounded-2xl px-5 py-3 text-[40px] font-bold leading-none tracking-[0.12em] tabular-nums md:text-[52px]">{activeSession.quiz_code}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="well rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted">{formatCategorySelectionLabel(activeSession.mapel)}</span>
                <span className="well rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted">{formatCategorySelectionLabel(activeSession.bab)}</span>
                <span className="well rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted">{formatCategorySelectionLabel(activeSession.sub_bab)}</span>
                <span className="rounded-md bg-primary/12 px-2 py-1 text-[12px] font-semibold text-primary">{activeSession.question_count} questions</span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 md:items-end">
              <span className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold capitalize ${activeSession.status === 'active' ? 'bg-primary/12 text-primary' :
                activeSession.status === 'waiting' ? 'well text-fg-muted' :
                activeSession.status === 'paused' ? 'bg-warn/15 text-highlight-fg' :
                'well text-fg-subtle'
              }`}>
                {activeSession.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
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
              const timerColor = isExpired ? 'text-danger'
                : isUrgent ? 'text-danger'
                : activeSession.status === 'paused' ? 'text-highlight-fg'
                : 'text-fg';
              return (
                <div className={`flex items-center justify-between rounded-2xl px-5 py-4 ${isUrgent || isExpired ? 'bg-danger/10' : activeSession.status === 'paused' ? 'bg-warn/12' : 'well'}`}>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-fg-muted">
                      {isExpired ? 'Waktu habis' : activeSession.status === 'paused' ? 'Sisa waktu (paused)' : 'Sisa waktu'}
                    </span>
                    <span className={`text-[32px] font-bold leading-tight tracking-tight tabular-nums ${timerColor}`}>
                      {h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${isExpired ? 'bg-danger' : activeSession.status === 'paused' ? 'bg-warn' : isUrgent ? 'bg-danger animate-pulse' : 'bg-primary'}`} aria-hidden="true" />
                </div>
              );
            })()}
            <div className="flex flex-wrap items-center gap-2">
              {activeSession.status === 'waiting' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('active')}
                    disabled={players.length === 0}
                    className="clay-primary h-11 rounded-xl px-5 text-[14px] font-semibold"
                    title={players.length === 0 ? 'Tunggu minimal satu pemain bergabung' : undefined}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="h-11 rounded-xl bg-danger/10 px-4 text-[14px] font-semibold text-danger transition-calm hover:bg-danger/15"
                  >
                    Cancel
                  </button>
                </>
              )}
              {(activeSession.status === 'active' || activeSession.status === 'paused') && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(activeSession.status === 'active' ? 'paused' : 'active')}
                    className={activeSession.status === 'active'
                      ? 'h-11 rounded-xl bg-warn/15 px-5 text-[14px] font-semibold text-highlight-fg transition-calm hover:bg-warn/20'
                      : 'clay-primary h-11 rounded-xl px-5 text-[14px] font-semibold'}
                  >
                    {activeSession.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(true)}
                    className="h-11 rounded-xl bg-danger/10 px-4 text-[14px] font-semibold text-danger transition-calm hover:bg-danger/15"
                  >
                    End
                  </button>
                </>
              )}

              <button
                type="button"
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
                className={ui.secondary}
              >
                Questions
              </button>

              {activeSession.status === 'waiting' && (
                <div className="relative flex items-center">
                  {activeSession.scheduled_at && !editingSchedule ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchedule(true);
                        const d = new Date(activeSession.scheduled_at!);
                        setEditScheduleDate(d.toISOString().split('T')[0]);
                        setEditScheduleTime(d.toTimeString().slice(0, 5));
                      }}
                      className="flex h-11 items-center gap-2 rounded-xl bg-primary/12 px-4 text-[13px] font-medium text-primary transition-calm hover:bg-primary/18"
                    >
                      <span className="text-[12px] font-medium">Auto-start</span>
                      <span className="font-bold tabular-nums">{scheduleCountdown || '...'}</span>
                    </button>
                  ) : !editingSchedule && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchedule(true);
                        setEditScheduleDate('');
                        setEditScheduleTime('');
                      }}
                      className={ui.secondary}
                    >
                      Set schedule
                    </button>
                  )}

                  {editingSchedule && (
                    <div className="glass-scrim fixed inset-0 z-[10001] flex items-center justify-center p-4" onClick={() => setEditingSchedule(false)}>
                      <div role="dialog" aria-modal="true" aria-labelledby="set-schedule-title" className={`${ui.modalShell} max-w-xs p-5`} onClick={(e) => e.stopPropagation()}>
                        <div className="mb-5 flex items-center justify-between">
                          <h4 id="set-schedule-title" className="text-[17px] font-bold tracking-tight text-fg">Set schedule</h4>
                          <button type="button" onClick={() => setEditingSchedule(false)} aria-label="Close" className={ui.iconClose}>
                            <CloseGlyph />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="edit-schedule-date" className="mb-1.5 block text-[12px] font-medium text-fg-muted">Tanggal</label>
                            <input
                              id="edit-schedule-date"
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
                              className={ui.input}
                            />
                          </div>
                          <div>
                            <label htmlFor="edit-schedule-time" className="mb-1.5 block text-[12px] font-medium text-fg-muted">Waktu</label>
                            <input
                              id="edit-schedule-time"
                              type="time"
                              value={editScheduleTime}
                              onChange={(e) => setEditScheduleTime(e.target.value)}
                              min={editScheduleDate === nowDateInput ? nowTimeInput : undefined}
                              className={ui.input}
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            {activeSession.scheduled_at && (
                              <button type="button" onClick={handleRemoveSchedule} className="h-11 flex-1 rounded-xl bg-danger/10 text-[14px] font-semibold text-danger transition-calm hover:bg-danger/15">Hapus</button>
                            )}
                            <button type="button" onClick={handleSaveSchedule} className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold">Simpan</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold tracking-tight text-fg">Players</h3>
                <span className="clay inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[13px] font-bold tabular-nums">{players.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={playersItemsPerPage}
                  aria-label="Players per page"
                  onChange={(e) => {
                    setPlayersItemsPerPage(Number(e.target.value));
                    setPlayersPage(1);
                  }}
                  className="well well-hover h-11 cursor-pointer rounded-xl px-3 text-[13px] font-medium text-fg transition-calm"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowLeaderboardView(true)}
                  disabled={players.length === 0}
                  className="h-11 rounded-xl bg-highlight/20 px-4 text-[14px] font-semibold text-highlight-fg transition-calm hover:bg-highlight/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Leaderboard
                </button>
              </div>
            </div>
            <div className="well min-h-0 flex-1 overflow-auto rounded-2xl">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="border-b border-line px-5 py-3 text-left text-[12px] font-semibold text-fg-muted">#</th>
                    <th className="border-b border-line px-5 py-3 text-left text-[12px] font-semibold text-fg-muted">Name</th>
                    {activeSession.quiz_mode !== 'standard' && (
                      <th className="border-b border-line px-5 py-3 text-left text-[12px] font-semibold text-fg-muted">Current</th>
                    )}
                    <th className="border-b border-line px-5 py-3 text-left text-[12px] font-semibold text-fg-muted">Score</th>
                    <th className="border-b border-line px-5 py-3 text-left text-[12px] font-semibold text-fg-muted">Waktu</th>
                    <th className="border-b border-line px-5 py-3 text-right text-[12px] font-semibold text-fg-muted"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-[14px] text-fg-muted">Waiting for players to join...</td></tr>
                  ) : players.slice((playersPage - 1) * playersItemsPerPage, playersPage * playersItemsPerPage).map((p, i) => (
                    <tr key={p.id} className="border-b border-line transition-calm last:border-b-0 hover:bg-[var(--well-bg)]">
                      <td className="whitespace-nowrap px-5 py-3 text-[13px] tabular-nums text-fg-muted">{((playersPage - 1) * playersItemsPerPage) + i + 1}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-[14px] font-semibold text-fg">
                        <span className="block max-w-[220px] truncate" title={p.name}>{p.name}</span>
                      </td>
                      {activeSession.quiz_mode !== 'standard' && (
                        <td className="whitespace-nowrap px-5 py-3 text-[13px] text-fg-muted">
                          <span title={`Soal saat ini: ${resolveCurrentLabel(p)}`}>{resolveCurrentLabel(p)}</span>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-5 py-3 text-[14px] font-semibold tabular-nums text-fg">
                        {activeSession.quiz_mode === 'standard' && !p.finished_at ? (
                          <span className="text-fg-muted">?/{activeSession.question_count}</span>
                        ) : (
                          <span>{p.score}<span className="font-normal text-fg-muted">/{activeSession.question_count}</span></span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-[13px] tabular-nums text-fg-muted">
                        {activeSession.quiz_mode === 'standard' && !p.finished_at ? (
                          <span>--:--</span>
                        ) : (
                          formatHMS(p.total_time)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setViewingPlayer(p)}
                          className="well well-hover h-11 md:h-10 rounded-xl px-3.5 text-[13px] font-medium text-fg transition-calm"
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
            <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
              <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
                <h3 className="text-[17px] font-bold tracking-tight text-fg">Active sessions</h3>
                <span className="clay inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[13px] font-bold tabular-nums">{activeSessions.length}</span>
              </div>
              {activeSessions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-6">
                  <div className="text-[13px] font-medium tabular-nums text-fg-muted">
                    Showing {activeSessions.length === 0 ? 0 : ((activePage - 1) * manageItemsPerPage) + 1}-{Math.min(activePage * manageItemsPerPage, activeSessions.length)} of {activeSessions.length}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={manageItemsPerPage}
                      aria-label="Sessions per page"
                      onChange={(event) => {
                        setManageItemsPerPage(Number(event.target.value));
                        setActivePage(1);
                      }}
                      className="well well-hover h-11 cursor-pointer rounded-xl px-3 text-[13px] font-medium text-fg transition-calm"
                    >
                      {[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                    </select>
                    <button type="button" onClick={() => setActivePage(Math.max(1, activePage - 1))} disabled={activePage === 1} className={ui.secondary}>Prev</button>
                    <span className="px-1 text-[13px] font-semibold tabular-nums text-fg-muted">{activePage}/{Math.ceil(activeSessions.length / manageItemsPerPage)}</span>
                    <button type="button" onClick={() => setActivePage(Math.min(Math.ceil(activeSessions.length / manageItemsPerPage), activePage + 1))} disabled={activePage === Math.ceil(activeSessions.length / manageItemsPerPage)} className={ui.secondary}>Next</button>
                  </div>
                </div>
              )}
              <div className="results-table-scroll-light min-h-0 flex-1 overflow-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Join code</th>
                      <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Status</th>
                      <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Players</th>
                      <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Questions</th>
                      <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Duration</th>
                      <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Expires in</th>
                      <th className="border-b border-line px-4 py-3 text-right text-[12px] font-semibold text-fg-muted sm:px-6">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center sm:px-6">
                          <p className="text-[15px] font-semibold text-fg">No active sessions found.</p>
                          <p className="mt-1 text-[13px] text-fg-muted">Create a quiz to start a session. Waiting, active, and paused sessions show up here.</p>
                        </td>
                      </tr>
                    ) : activeSessions.slice((activePage - 1) * manageItemsPerPage, activePage * manageItemsPerPage).map(s => (
                      <tr key={s.id} className="border-b border-line transition-calm last:border-b-0 hover:bg-[var(--well-bg)]">
                        <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                          <span className="clay inline-flex rounded-lg px-2.5 py-1 text-[14px] font-bold tabular-nums tracking-[0.06em]" title={s.quiz_code}>{s.quiz_code}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                          <span className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold capitalize ${s.status === 'active' ? 'bg-primary/12 text-primary' : s.status === 'paused' ? 'bg-warn/15 text-highlight-fg' : 'well text-fg-muted'}`}>{s.status}</span>
                          {s.status === 'waiting' && s.scheduled_at && (
                            <span className="ml-2 inline-flex h-6 items-center rounded-md bg-primary/12 px-2 text-[12px] font-semibold text-primary" title={new Date(s.scheduled_at).toLocaleString('id-ID')}>
                              {new Date(s.scheduled_at).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] font-semibold tabular-nums text-fg sm:px-6">{s.player_count || 0}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] tabular-nums text-fg-muted sm:px-6">{s.question_count}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] tabular-nums text-fg-muted sm:px-6">{s.duration_minutes} min</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] sm:px-6">
                          {s.expires_at ? (
                            <span className={`font-semibold tabular-nums ${s.status === 'active' || s.status === 'paused' ? 'text-fg' : 'text-danger'}`}>
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
                            <span className="text-fg-muted">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right sm:px-6">
                          <button type="button" onClick={() => setActiveSession(s)} className="h-11 md:h-10 rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18">View detail</button>
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
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
                <div className="glass shrink-0 rounded-3xl p-4 sm:p-5">
                  <div className="mb-3">
                    <h3 className="text-[17px] font-bold tracking-tight text-fg">Quiz history</h3>
                    <p className="mt-0.5 text-[13px] text-fg-muted">Filter by topic to inspect completed sessions.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <span className="block text-[12px] font-medium text-fg-muted">Mapel</span>
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
                      <span className="block text-[12px] font-medium text-fg-muted">Bab</span>
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
                      <span className="block text-[12px] font-medium text-fg-muted">Sub-bab</span>
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

                <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
                  {filteredHistory.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-6">
                      <div className="text-[13px] font-medium tabular-nums text-fg-muted">
                        Showing {filteredHistory.length === 0 ? 0 : ((historyPage - 1) * historyItemsPerPage) + 1}-{Math.min(historyPage * historyItemsPerPage, filteredHistory.length)} of {filteredHistory.length}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={historyItemsPerPage}
                          aria-label="History rows per page"
                          onChange={(event) => {
                            setHistoryItemsPerPage(Number(event.target.value));
                            setHistoryPage(1);
                          }}
                          className="well well-hover h-11 cursor-pointer rounded-xl px-3 text-[13px] font-medium text-fg transition-calm"
                        >
                          {[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                        </select>
                        <button type="button" onClick={() => setHistoryPage(Math.max(1, historyPage - 1))} disabled={historyPage === 1} className={ui.secondary}>Prev</button>
                        <span className="px-1 text-[13px] font-semibold tabular-nums text-fg-muted">{historyPage}/{Math.ceil(filteredHistory.length / historyItemsPerPage)}</span>
                        <button type="button" onClick={() => setHistoryPage(Math.min(Math.ceil(filteredHistory.length / historyItemsPerPage), historyPage + 1))} disabled={historyPage === Math.ceil(filteredHistory.length / historyItemsPerPage)} className={ui.secondary}>Next</button>
                      </div>
                    </div>
                  )}
                  <div className="results-table-scroll-light min-h-0 flex-1 overflow-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Join code</th>
                          <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Topik</th>
                          <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Players</th>
                          <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Winner</th>
                          <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Top score</th>
                          <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Date</th>
                          <th className="border-b border-line px-4 py-3 text-left text-[12px] font-semibold text-fg-muted sm:px-6">Status</th>
                          <th className="border-b border-line px-4 py-3 text-right text-[12px] font-semibold text-fg-muted sm:px-6">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center sm:px-6">
                              <p className="text-[15px] font-semibold text-fg">No history found.</p>
                              <p className="mt-1 text-[13px] text-fg-muted">Finished quiz sessions appear here. Loosen the topic filters to see more.</p>
                            </td>
                          </tr>
                        ) : filteredHistory.slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage).map(h => (
                          <tr key={h.id} className="border-b border-line transition-calm last:border-b-0 hover:bg-[var(--well-bg)]">
                            <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                              <span className="clay inline-flex rounded-lg px-2.5 py-1 text-[14px] font-bold tabular-nums tracking-[0.06em]" title={h.quiz_code}>{h.quiz_code}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-[13px] capitalize text-fg-muted sm:px-6">
                              <span
                                className="block max-w-[220px] truncate"
                                title={`${h.mapel?.replace(/_/g, ' ')} - ${h.bab?.replace(/_/g, ' ')} - ${h.sub_bab?.replace(/_/g, ' ')}`}
                              >
                                {h.mapel?.replace(/_/g, ' ')} - {h.bab?.replace(/_/g, ' ')} - {h.sub_bab?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-[14px] font-medium tabular-nums text-fg-muted sm:px-6">{h.player_count}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-[14px] font-semibold text-fg sm:px-6">
                              <span className="block max-w-[180px] truncate" title={h.winner}>{h.winner}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-[14px] font-semibold tabular-nums text-primary sm:px-6">{h.top_score} / {h.question_count}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-fg-muted sm:px-6">{new Date(h.created_at).toLocaleString()}</td>
                            <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                              <span className="well inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold capitalize text-fg-muted">{h.status}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-right sm:px-6">
                              <button type="button" onClick={() => setActiveSession(h)} className="h-11 md:h-10 rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18">View</button>
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
        theme={theme}
      />

      {/* Player Answers Modal */}
      {viewingPlayer && (
        <div className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4" onClick={() => setViewingPlayer(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-answers-title"
            className="glass-sheet animate-in flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-4xl text-fg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
              <div className="flex min-w-0 flex-col gap-2">
                <h2 id="player-answers-title" className="truncate text-[18px] font-bold tracking-tight text-fg">
                  {viewingPlayer.name}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold ${viewingPlayer.finished_at ? 'bg-primary/12 text-primary' : 'bg-warn/15 text-highlight-fg'}`}>
                    {viewingPlayer.finished_at ? 'Finished' : 'Playing'}
                  </span>
                  <span className="well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-medium text-fg-muted" title={formatCategorySelectionLabel(activeSession?.mapel)}>
                    {formatCategorySelectionLabel(activeSession?.mapel)}
                  </span>
                  <span className="well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-medium text-fg-muted" title={formatCategorySelectionLabel(activeSession?.bab)}>
                    {formatCategorySelectionLabel(activeSession?.bab)}
                  </span>
                  <span className="well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-medium text-fg-muted" title={formatCategorySelectionLabel(activeSession?.sub_bab)}>
                    {formatCategorySelectionLabel(activeSession?.sub_bab)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPlayer(null)}
                aria-label="Close"
                className={ui.iconClose}
              >
                <CloseGlyph />
              </button>
            </div>

            {/* Content */}
            <div className="result-details-scroll-light flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {loadingAnswers ? (
                <div className="flex items-center justify-center gap-2 py-20 text-[13px] font-medium text-fg-muted" role="status">
                  <span className="spinner-calm h-4 w-4" aria-hidden="true" />
                  Loading answers...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <div className="clay rounded-2xl px-4 py-3">
                        <p className="text-[24px] font-bold tracking-tight tabular-nums text-fg">
                          {activeSession?.question_count || 0}
                        </p>
                        <p className="text-[12px] font-medium text-fg-muted">
                          Total
                        </p>
                      </div>
                      <div className="clay rounded-2xl px-4 py-3">
                        <p className="text-[24px] font-bold tracking-tight tabular-nums text-primary">
                          {viewingPlayer.score}
                        </p>
                        <p className="text-[12px] font-medium text-fg-muted">
                          Correct
                        </p>
                      </div>
                      <div className="clay rounded-2xl px-4 py-3">
                        <p className="text-[24px] font-bold tracking-tight tabular-nums text-danger">
                          {(activeSession?.question_count || 0) - viewingPlayer.score}
                        </p>
                        <p className="text-[12px] font-medium text-fg-muted">
                          Incorrect
                        </p>
                      </div>
                      <div className="clay rounded-2xl px-4 py-3">
                        <p className="text-[24px] font-bold tracking-tight tabular-nums text-fg">
                          {activeSession?.question_count ? Math.round((viewingPlayer.score / activeSession.question_count) * 100) : 0}%
                        </p>
                        <p className="text-[12px] font-medium text-fg-muted">
                          Score
                        </p>
                      </div>
                    </div>
                    <div className="well flex items-center justify-between rounded-2xl px-4 py-3">
                      <span className="text-[13px] font-medium text-fg-muted">
                        Time spent
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums text-fg">
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
                          <div key={`${qId}-${idx}`} className="well overflow-hidden rounded-2xl">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() => toggleQuestion(qId)}
                              className="well-hover flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 transition-calm"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="clay inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold tabular-nums">
                                  {idx + 1}
                                </span>
                                {answer ? (
                                  <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold ${answer.is_correct ? 'bg-primary/12 text-primary' : 'bg-danger/12 text-danger'}`}>
                                    {answer.is_correct ? 'Correct' : 'Incorrect'}
                                  </span>
                                ) : (
                                  <span className="well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-medium text-fg-muted">
                                    Not answered
                                  </span>
                                )}
                              </div>
                              <svg
                                className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                aria-hidden="true"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {isExpanded && (
                              <div className="space-y-4 border-t border-line px-4 pb-4">
                                <div className="pt-4">
                                  <p className="mb-2 text-[12px] font-medium text-fg-muted">
                                    Question
                                  </p>
                                  <RichContent html={question.question_text} className="text-[14px] text-fg" />
                                </div>

                                {answer && (
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div className={`rounded-2xl px-4 py-3 ${answer.is_correct ? 'bg-primary/10' : 'bg-danger/10'}`}>
                                      <p className={`mb-1.5 text-[12px] font-semibold ${answer.is_correct ? 'text-primary' : 'text-danger'}`}>
                                        User answer
                                      </p>
                                      <RichContent html={answer.user_answer} className="text-[14px] font-medium text-fg" />
                                      <p className="mt-2 text-[12px] tabular-nums text-fg-muted">
                                        {formatHMS(answer.time_taken)}
                                      </p>
                                    </div>

                                    {!answer.is_correct && (
                                      <div className="rounded-2xl bg-primary/10 px-4 py-3">
                                        <p className="mb-1.5 text-[12px] font-semibold text-primary">
                                          Correct answer{isShortAnswer ? '' : ` (${question.correct_answer})`}
                                        </p>
                                        <RichContent html={correctText} className="text-[14px] font-medium text-fg" />
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
        <div className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4" onClick={() => setShowViewQuestions(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-analytics-title"
            className="glass-sheet animate-in flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-4xl text-fg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
              <div className="flex min-w-0 flex-col gap-2">
                <h2 id="question-analytics-title" className="text-[18px] font-bold tracking-tight text-fg">
                  Question analytics
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-medium tabular-nums text-fg-muted">
                    {activeSession.question_count} questions
                  </span>
                  <span className="well inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-medium tabular-nums text-fg-muted">
                    {players.length} players
                  </span>
                  <button
                    type="button"
                    aria-pressed={showAllAnswers}
                    onClick={() => setShowAllAnswers(!showAllAnswers)}
                    className={`h-11 md:h-9 rounded-lg px-3 text-[12px] font-semibold transition-calm ${showAllAnswers ? 'bg-primary/12 text-primary' : 'well well-hover text-fg-muted'}`}
                  >
                    {showAllAnswers ? 'Hide answers' : 'Show answers'}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowViewQuestions(false)}
                aria-label="Close"
                className={ui.iconClose}
              >
                <CloseGlyph />
              </button>
            </div>

            {/* Content */}
            <div className="result-details-scroll-light flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {loadingAllAnswers ? (
                <div className="flex items-center justify-center gap-2 py-20 text-[13px] font-medium text-fg-muted" role="status">
                  <span className="spinner-calm h-4 w-4" aria-hidden="true" />
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
                    const statusBg = isAllCorrect ? 'bg-primary/12 text-primary'
                      : isAllWrong ? 'bg-danger/12 text-danger'
                      : 'bg-warn/15 text-highlight-fg';

                    return (
                      <div key={qId} className="well overflow-hidden rounded-2xl">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="clay inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold tabular-nums">{idx + 1}</span>
                          <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold tabular-nums ${statusBg}`}>
                            {correctAnswers.length}/{totalAnswers.length} benar
                          </span>
                        </div>
                        <div className="space-y-3 border-t border-line px-4 pb-4">
                          <div className="pt-3">
                            <p className="mb-2 text-[12px] font-medium text-fg-muted">
                              Question
                            </p>
                            <RichContent html={question.question_text} className="text-[14px] text-fg" />
                          </div>

                          {/* Correct Answer */}
                          {showAllAnswers && (
                            <div className="rounded-2xl bg-primary/10 px-4 py-3">
                              <p className="mb-1.5 text-[12px] font-semibold text-primary">Jawaban benar</p>
                              <RichContent html={correctOptionText} className="text-[14px] font-medium text-fg" />
                            </div>
                          )}

                          {/* Who answered correctly */}
                          <div className="rounded-2xl border border-line px-4 py-3">
                            <p className="mb-2 text-[12px] font-medium text-fg-muted">
                              Pemain benar · {correctAnswers.length}
                            </p>
                            {correctPlayerNames.length === 0 ? (
                              <p className="text-[13px] text-fg-muted">Belum ada</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {correctPlayerNames.map((name, i) => (
                                  <span key={i} className="rounded-md bg-primary/12 px-2 py-1 text-[12px] font-semibold text-primary">
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
                              <div className="rounded-2xl border border-line px-4 py-3">
                                <p className="mb-2 text-[12px] font-medium text-fg-muted">
                                  Pemain salah · {incorrectAnswers.length}
                                </p>
                                {incorrectPlayerNames.length === 0 ? (
                                  <p className="text-[13px] text-fg-muted">Belum ada</p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {incorrectPlayerNames.map((name, i) => (
                                      <span key={i} className="rounded-md bg-danger/12 px-2 py-1 text-[12px] font-semibold text-danger">
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
        <div className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={() => setShowEndConfirm(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="end-quiz-title" className={`${ui.modalShell} max-w-sm p-6`} onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/12 text-danger" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 id="end-quiz-title" className="mb-1.5 text-[18px] font-bold tracking-tight text-fg">Akhiri quiz?</h3>
            <p className="mb-6 text-[14px] leading-relaxed text-fg-muted">Apakah anda yakin menyelesaikan quiz sekarang?</p>
            <div className="flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setShowEndConfirm(false)}
                className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false);
                  handleStatusChange('finished');
                }}
                className="clay-danger h-11 flex-1 rounded-xl text-[14px] font-semibold"
              >
                Akhiri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Quiz Confirmation Modal */}
      {showCancelConfirm && activeSession && (
        <div className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={() => setShowCancelConfirm(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="cancel-quiz-title" className={`${ui.modalShell} max-w-sm p-6`} onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/12 text-danger" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 id="cancel-quiz-title" className="mb-1.5 text-[18px] font-bold tracking-tight text-fg">Batalkan quiz?</h3>
            <p className="mb-6 text-[14px] leading-relaxed text-fg-muted">Semua data pemain dan jawaban akan dihapus secara permanen.</p>
            <div className="flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setShowCancelConfirm(false)}
                className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
              >
                Batal
              </button>
              <button
                type="button"
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
                className="clay-danger h-11 flex-1 rounded-xl text-[14px] font-semibold"
              >
                Ya, batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {createErrorModal && (
        <div className="glass-scrim fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="create-error-title" className={`${ui.modalShell} max-w-md p-6 text-fg`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger/12 text-danger" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 id="create-error-title" className="text-[18px] font-bold tracking-tight">Kuis tidak bisa dibuat</h3>
                <p className="text-[13px] text-fg-muted">Jumlah soal tidak mencukupi</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <div className="clay rounded-2xl px-4 py-3">
                <p className="text-[24px] font-bold tabular-nums text-danger">{createErrorModal.availableCount}</p>
                <p className="text-[12px] font-medium text-fg-muted">Soal tersedia</p>
              </div>
              <div className="clay rounded-2xl px-4 py-3">
                <p className="text-[24px] font-bold tabular-nums text-fg">{createErrorModal.requestedCount}</p>
                <p className="text-[12px] font-medium text-fg-muted">Soal diminta</p>
              </div>
            </div>

            <p className="mb-5 text-[14px] leading-relaxed text-fg-muted">
              Filter saat ini hanya menemukan {createErrorModal.availableCount} soal. Tambah soal pada topik ini, kurangi jumlah soal, atau pilih topik lain.
            </p>

            <button
              type="button"
              autoFocus
              onClick={() => setCreateErrorModal(null)}
              className="clay-primary h-11 w-full rounded-xl text-[14px] font-semibold"
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

function Pagination({ totalItems, itemsPerPage, currentPage, onPageChange }: { totalItems: number, itemsPerPage: number, currentPage: number, onPageChange: (page: number) => void, theme?: 'light' | 'dark' }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-3 flex flex-wrap items-center justify-between gap-2" aria-label="Pagination">
      <p className="text-[13px] tabular-nums text-fg-muted">
        Showing <span className="font-semibold text-fg">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-fg">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
        <span className="font-semibold text-fg">{totalItems}</span> results
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={ui.secondary}
        >
          Previous
        </button>
        <div className="hidden gap-1 sm:flex">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              type="button"
              aria-current={currentPage === i + 1 ? 'page' : undefined}
              onClick={() => onPageChange(i + 1)}
              className={`h-11 min-w-11 rounded-xl px-2 text-[13px] font-semibold tabular-nums transition-calm ${currentPage === i + 1 ? 'clay' : 'well well-hover text-fg-muted'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={ui.secondary}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
