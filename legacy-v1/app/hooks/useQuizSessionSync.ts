"use client";

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { secureLoad } from '@/lib/security';
import { fetchQuizByCode, type KuisLog, type Player } from '@/lib/quiz';
import { type ShuffledQuestion } from '@/lib/questions';

type UseQuizSessionSyncArgs = {
  quizCode: string;
  session: KuisLog | null;
  setSession: Dispatch<SetStateAction<KuisLog | null>>;
  player: Player | null;
  setPlayer: Dispatch<SetStateAction<Player | null>>;
  isFinished: boolean;
  setIsFinished: Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  loadError: string | null;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setDoubtFlags: Dispatch<SetStateAction<boolean[]>>;
  setLocalAnswers: Dispatch<SetStateAction<(string | null)[]>>;
  setSelectedAnswer: Dispatch<SetStateAction<string | null>>;
  setScore: Dispatch<SetStateAction<number>>;
  currentQuestion: ShuffledQuestion | null;
  currentIndex: number;
  startTime: number;
  setStartTime: Dispatch<SetStateAction<number>>;
  pausedAt: number | null;
  setPausedAt: Dispatch<SetStateAction<number | null>>;
  setTimeLeftDisplay: Dispatch<SetStateAction<string>>;
  setWaitTimer: Dispatch<SetStateAction<string | null>>;
  fetchLeaderboard: (kuisId: string) => Promise<void>;
  loadQuestion: (index: number) => Promise<void>;
  handleTimeout: () => Promise<void>;
};

export default function useQuizSessionSync({
  quizCode,
  session,
  setSession,
  player,
  setPlayer,
  isFinished,
  setIsFinished,
  loading,
  setLoading,
  loadError,
  setCurrentIndex,
  setDoubtFlags,
  setLocalAnswers,
  setSelectedAnswer,
  setScore,
  currentQuestion,
  currentIndex,
  startTime,
  setStartTime,
  pausedAt,
  setPausedAt,
  setTimeLeftDisplay,
  setWaitTimer,
  fetchLeaderboard,
  loadQuestion,
  handleTimeout,
}: UseQuizSessionSyncArgs) {
  const router = useRouter();

  useEffect(() => {
    fetchQuizByCode(quizCode).then(quiz => {
      if (!quiz) {
        alert('Kuis tidak ditemukan');
        router.push('/');
        return;
      }
      setSession(quiz);
      setLoading(false);

      if (quiz.status === 'finished') {
        setIsFinished(true);
        void fetchLeaderboard(quiz.id);
      }

      const savedPlayerId = secureLoad<string>(`quiz_player_${quizCode}`);
      if (savedPlayerId) {
        supabase.from('public_players').select('id, name, kuis_id, score, total_time, finished_at, joined_at, horse_skin').eq('id', savedPlayerId).single().then(({ data, error }) => {
          if (error) {
            console.error('Restore player failed:', error.message);
            return;
          }
          if (data) {
            // Always restore the player record so the leaderboard / score
            // panel can show "you" and the final score after a refresh.
            setPlayer({ ...data, question_ids: [] } as Player);
            // Mirror the DB score into React state so the finished view shows
            // the real score (standard mode submits via RPC, not local state).
            if (typeof data.score === 'number') {
              setScore(data.score);
            }

            if (data.finished_at) {
              setIsFinished(true);
              return;
            }
            const savedIndex = secureLoad<string>(`quiz_index_${quizCode}`);
            if (savedIndex) {
              setCurrentIndex(parseInt(savedIndex));
            }
            const savedDoubts = secureLoad<string>(`quiz_doubts_${quizCode}`);
            if (savedDoubts) {
              try { setDoubtFlags(JSON.parse(savedDoubts)); } catch { }
            } else if (quiz) {
              setDoubtFlags(Array(quiz.question_count).fill(false));
            }
            const savedAnswers = secureLoad<string>(`quiz_answers_${quizCode}`);
            if (savedAnswers) {
              try {
                const parsedAnswers = JSON.parse(savedAnswers);
                setLocalAnswers(parsedAnswers);
                if (savedIndex && parsedAnswers[parseInt(savedIndex)]) {
                  setSelectedAnswer(parsedAnswers[parseInt(savedIndex)]);
                }
              } catch { }
            } else if (quiz) {
              setLocalAnswers(Array(quiz.question_count).fill(null));
            }
          }
        });
      }
    });

    const channel = supabase.channel(`quiz_${quizCode}_${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kuis_logs', filter: `quiz_code=eq.${quizCode}` },
        (payload) => {
          const updated = payload.new as KuisLog;
          setSession(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizCode, router, fetchLeaderboard, setSession, setLoading, setIsFinished, setPlayer, setCurrentIndex, setDoubtFlags, setLocalAnswers, setSelectedAnswer, setScore]);

  useEffect(() => {
    if (isFinished && session) {
      const syncLeaderboard = async () => {
        await fetchLeaderboard(session.id);
      };
      void syncLeaderboard();

      const lbChannel = supabase.channel(`leaderboard_${session.id}_${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'player', filter: `kuis_id=eq.${session.id}` },
          () => {
            void fetchLeaderboard(session.id);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(lbChannel); };
    }
  }, [isFinished, session, fetchLeaderboard]);

  useEffect(() => {
    const syncCurrentQuestion = async () => {
      if (session?.status === 'active' && player && !isFinished && !currentQuestion && !loading && !loadError) {
        await loadQuestion(currentIndex);
      }
    };
    void syncCurrentQuestion();
  }, [session?.status, player, isFinished, currentIndex, currentQuestion, loading, loadError, loadQuestion]);

  useEffect(() => {
    const syncStartTime = async () => {
      if (session?.status === 'active' && player && !isFinished && currentQuestion && startTime === 0) {
        setStartTime(Date.now());
      }
    };
    void syncStartTime();
  }, [session?.status, player, isFinished, currentQuestion, startTime, setStartTime]);

  useEffect(() => {
    const syncFinishedStatus = async () => {
      if (session?.status === 'finished' && !isFinished) {
        await handleTimeout();
      }
    };
    void syncFinishedStatus();
  }, [session?.status, isFinished, handleTimeout]);

  useEffect(() => {
    if ((session?.status === 'active' || session?.status === 'paused') && session.expires_at && !isFinished) {
      const interval = setInterval(() => {
        if (session.status === 'paused') {
          setTimeLeftDisplay('PAUSED');
          return;
        }

        const diff = new Date(session.expires_at!).getTime() - Date.now();
        if (diff <= 0) {
          clearInterval(interval);
          void handleTimeout();
        } else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeftDisplay(`${m}:${s.toString().padStart(2, '0')}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [session?.status, session?.expires_at, isFinished, handleTimeout, setTimeLeftDisplay]);

  useEffect(() => {
    const syncPauseState = async () => {
      if (session?.status === 'paused' && !pausedAt) {
        setPausedAt(session.paused_at ? new Date(session.paused_at).getTime() : Date.now());
      } else if (session?.status === 'active' && pausedAt) {
        const pauseDuration = Date.now() - pausedAt;
        if (startTime > 0) {
          setStartTime(prev => prev + pauseDuration);
        }
        setPausedAt(null);
      }
    };
    void syncPauseState();
  }, [session?.status, session?.paused_at, pausedAt, startTime, setPausedAt, setStartTime]);

  useEffect(() => {
    if (session?.status === 'waiting' && session.scheduled_at) {
      const updateTimer = () => {
        const diff = new Date(session.scheduled_at!).getTime() - Date.now();
        if (diff <= 0) {
          setWaitTimer(null);
          return false;
        }

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        if (hours > 0) {
          setWaitTimer(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        } else {
          setWaitTimer(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
        return true;
      };

      const shouldContinue = updateTimer();
      if (!shouldContinue) return;

      const interval = setInterval(() => {
        const keepGoing = updateTimer();
        if (!keepGoing) clearInterval(interval);
      }, 1000);

      return () => clearInterval(interval);
    }

    const resetWaitTimer = async () => {
      setWaitTimer(null);
    };
    void resetWaitTimer();
  }, [session?.status, session?.scheduled_at, setWaitTimer]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session && !isFinished) {
        fetchQuizByCode(quizCode).then(s => { if (s) setSession(s); });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [quizCode, session, isFinished, setSession]);

  useEffect(() => {
    if (session && !isFinished) {
      // Reduced polling frequency since real-time subscriptions handle most updates
      // Polling is just a fallback for reliability
      const pollInterval = session.status === 'waiting' ? 10000 : 30000;
      const interval = setInterval(() => {
        fetchQuizByCode(quizCode).then(s => { if (s) setSession(s); });
      }, pollInterval);
      return () => clearInterval(interval);
    }
  }, [quizCode, session, isFinished, setSession]);
}
