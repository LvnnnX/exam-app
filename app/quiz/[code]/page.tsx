"use client";

import React, { useState, useEffect, use, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { secureLoad, secureSave, secureRemove } from '@/lib/security';
import { fetchQuizByCode, joinLiveQuiz, submitSecureAnswer, getJitQuestion, finishPlayerQuiz, normalizeQuizCode, type KuisLog, type Player } from '@/lib/quiz';
import { type ShuffledQuestion } from '@/lib/questions';
import { useRouter } from 'next/navigation';
import RichContent from '@/app/components/RichContent';
import { useExamSecurity } from '@/app/hooks/useExamSecurity';
import TabWarningModal from '@/app/components/TabWarningModal';

type AnswerData = string;

export default function QuizSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;
  const quizCode = normalizeQuizCode(code);
  const router = useRouter();

  const [session, setSession] = useState<KuisLog | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [name, setName] = useState('');

  // Game state
  const [currentQuestion, setCurrentQuestion] = useState<ShuffledQuestion | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState<string>('');
  const [waitTimer, setWaitTimer] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerData | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Standard mode state
  const [doubtFlags, setDoubtFlags] = useState<boolean[]>([]);
  const [localAnswers, setLocalAnswers] = useState<(string | null)[]>([]);
  const [showNavPopup, setShowNavPopup] = useState(false);
  const isStandard = session?.quiz_mode === 'standard';

  const selectedAnswerRef = useRef<AnswerData | null>(null);
  useEffect(() => {
    selectedAnswerRef.current = selectedAnswer;
  }, [selectedAnswer]);

  // ─── Anti-Cheat Security ──────────────────────────────────────────
  const examSecurityActive = session?.status === 'active' && !!player && !isFinished;
  const { warningCount, showWarningModal, dismissWarning } = useExamSecurity({
    isActive: examSecurityActive,
    enableTabDetection: true,
    enableWakeLock: true,
    onForceSubmit: useCallback(() => {
      // Strike 3 — auto-submit all answers immediately
      if (!player || isFinished) return;
      const timeTaken = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;
      const q = currentQuestion;
      if (q) {
        const currentSelection = selectedAnswerRef.current;
        const answerText = currentSelection || '';
        void submitSecureAnswer(player.id, q.id, answerText, timeTaken, currentIndex);
      }
      void finishPlayerQuiz(player.id);
      secureRemove(`quiz_index_${quizCode}`);
      setIsFinished(true);
    }, [player, isFinished, startTime, currentQuestion, quizCode]),
  });

  // 1. Initial Load & Subscription
  useEffect(() => {
    fetchQuizByCode(quizCode).then(quiz => {
      if (!quiz) {
        alert("Kuis tidak ditemukan");
        router.push('/');
        return;
      }
      setSession(quiz);
      setLoading(false);

      if (quiz.status === 'finished') {
        setIsFinished(true);
        fetchLeaderboard(quiz.id);
      }

      // Check localStorage for existing player
      const savedPlayerId = secureLoad<string>(`quiz_player_${quizCode}`);
      if (savedPlayerId) {
        supabase.from('public_players').select('*').eq('id', savedPlayerId).single().then(({ data }) => {
          if (data) {
            // Rule 4 & 5: Strict check for completion state on mount
            if (data.finished_at) {
              setIsFinished(true);
              return;
            }
            // Add missing properties for Player type
            setPlayer({ ...data, question_ids: [] } as Player);
            // Restore index (Questions are loaded JIT)
            const savedIndex = secureLoad<string>(`quiz_index_${quizCode}`);
            if (savedIndex) {
              setCurrentIndex(parseInt(savedIndex));
            }
          }
        });
      }
    });

    const channel = supabase.channel(`quiz_${quizCode}`)
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
  }, [quizCode, router]);

  // Layer 1: Visibility Check (Immediately sync when returning to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (session?.status === 'active' || session?.status === 'paused')) {
        fetchQuizByCode(quizCode).then(s => { if (s) setSession(s); });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [quizCode, session?.status]);

  // Layer 2: Polling Fallback (Backup sync every 15s in case realtime fails)
  useEffect(() => {
    if (session?.status === 'active' || session?.status === 'paused') {
      const interval = setInterval(() => {
        fetchQuizByCode(quizCode).then(s => { if (s) setSession(s); });
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [quizCode, session?.status]);

  // Subscription for leaderboard when finished
  useEffect(() => {
    if (isFinished && session) {
      fetchLeaderboard(session.id);
      const lbChannel = supabase.channel('leaderboard')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'player', filter: `kuis_id=eq.${session.id}` },
          () => {
            fetchLeaderboard(session.id);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(lbChannel); };
    }
  }, [isFinished, session]);

  const fetchLeaderboard = async (kuisId: string) => {
    const { data } = await supabase.from('public_players').select('*').eq('kuis_id', kuisId).order('score', { ascending: false }).order('total_time', { ascending: true });
    if (data) setLeaderboard(data as Player[]);
  };

  const handleJoin = async () => {
    if (!name.trim()) return;
    setLoading(true);

    if (session?.status === 'active' || session?.status === 'paused') {
      alert('Kuis sedang berjalan atau ditunda. Anda tidak dapat bergabung.');
      setLoading(false);
      return;
    }

    const result = await joinLiveQuiz(quizCode, name.trim());
    if ('error' in result) {
      alert(result.error);
      setLoading(false);
      return;
    }

    setPlayer(result);
    secureSave(`quiz_player_${quizCode}`, result.id);
    secureSave(`quiz_index_${quizCode}`, '0');
    // Initialize standard mode arrays
    if (session) {
      setDoubtFlags(Array(session.question_count).fill(false));
      setLocalAnswers(Array(session.question_count).fill(null));
    }
    setLoading(false);
  };

  const loadQuestion = useCallback(async (index: number) => {
    if (!player) return;
    setLoading(true);
    setLoadError(null);
    const qData = await getJitQuestion(player.id, index);
    if (qData) {
      setCurrentQuestion(qData);
    } else {
      setLoadError("Gagal mengambil soal. Silakan refresh halaman atau hubungi admin.");
    }
    setLoading(false);
  }, [player]);

  useEffect(() => {
    if (session?.status === 'active' && player && !isFinished && !currentQuestion && !loading && !loadError) {
      loadQuestion(currentIndex);
    }
  }, [session?.status, player, isFinished, currentIndex, currentQuestion, loading, loadError, loadQuestion]);

  useEffect(() => {
    if (session?.status === 'active' && player && !isFinished && currentQuestion && startTime === 0) {
      setStartTime(Date.now());
    }
  }, [session?.status, player, isFinished, currentQuestion, startTime]);

  const handleTimeout = useCallback(async () => {
    if (!player || !session || isFinished) return;

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const q = currentQuestion;

    if (q) {
      const currentSelection = selectedAnswerRef.current;
      const answerText = currentSelection || '';
      await submitSecureAnswer(player.id, q.id, answerText, timeTaken, currentIndex);
    }

    await finishPlayerQuiz(player.id);
    secureRemove(`quiz_index_${quizCode}`);
    setIsFinished(true);
  }, [player, session, isFinished, startTime, currentQuestion, quizCode]);

  // Handle auto-finish when admin ends the quiz
  useEffect(() => {
    if (session?.status === 'finished' && !isFinished) {
      handleTimeout();
    }
  }, [session?.status, isFinished, handleTimeout]);

  useEffect(() => {
    // Global timer - use server's expires_at for perfect sync with admin
    if ((session?.status === 'active' || session?.status === 'paused') && session.expires_at && !isFinished) {
      const interval = setInterval(() => {
        if (session.status === 'paused') {
          setTimeLeftDisplay('PAUSED');
          return;
        }

        const diff = new Date(session.expires_at!).getTime() - Date.now();
        if (diff <= 0) {
          clearInterval(interval);
          handleTimeout();
        } else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeftDisplay(`${m}:${s.toString().padStart(2, '0')}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [session?.status, session?.expires_at, player, isFinished, handleTimeout]);

  // Adjust startTime when quiz is paused/resumed
  useEffect(() => {
    if (session?.status === 'paused' && !pausedAt) {
      setPausedAt(session.paused_at ? new Date(session.paused_at).getTime() : Date.now());
    } else if (session?.status === 'active' && pausedAt) {
      const pauseDuration = Date.now() - pausedAt;
      if (startTime > 0) {
        setStartTime(prev => prev + pauseDuration);
      }
      setPausedAt(null);
    }
  }, [session?.status, pausedAt, startTime]);

  // Handle waiting room countdown
  useEffect(() => {
    if (session?.status === 'waiting' && session.scheduled_at) {
      const updateTimer = () => {
        const diff = new Date(session.scheduled_at!).getTime() - Date.now();
        if (diff <= 0) {
          setWaitTimer(null);
          return false; // stop
        } else {
          const hours = Math.floor(diff / 3600000);
          const minutes = Math.floor((diff % 3600000) / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);

          if (hours > 0) {
            setWaitTimer(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          } else {
            setWaitTimer(`${minutes}:${seconds.toString().padStart(2, '0')}`);
          }
          return true; // continue
        }
      };

      const shouldContinue = updateTimer();
      if (!shouldContinue) return;

      const interval = setInterval(() => {
        const keepGoing = updateTimer();
        if (!keepGoing) clearInterval(interval);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setWaitTimer(null);
    }
  }, [session?.status, session?.scheduled_at]);

  const handleAnswer = async (opt: AnswerData | null) => {
    if (!player || !session || isFinished) return;

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    if (!currentQuestion) return;
    const answerText = opt || '';

    const result = await submitSecureAnswer(player.id, currentQuestion.id, answerText, timeTaken, currentIndex);
    const isCorrect = result.success ? result.is_correct : false;

    // Track local answers for Standard mode nav popup
    if (isStandard) {
      const updated = [...localAnswers];
      updated[currentIndex] = answerText;
      setLocalAnswers(updated);
    }

    if (isCorrect) setScore(s => s + 1);

    setSelectedAnswer(null);
    if (currentIndex + 1 < (session?.question_count || 0)) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentQuestion(null); // Trigger JIT load
      secureSave(`quiz_index_${quizCode}`, nextIndex.toString());
      setStartTime(Date.now());
    } else {
      await finishPlayerQuiz(player.id);
      // Rule 6: Clear active session data
      secureRemove(`quiz_index_${quizCode}`);
      secureRemove(`quiz_player_${quizCode}`);
      setIsFinished(true);
      // Rule 7: Replace history state
      router.replace(`/quiz/${quizCode}`);
    }
  };

  // Standard mode: navigate to any question in live quiz
  const goToQuizQuestion = async (targetIndex: number) => {
    if (!player || !session || isFinished) return;
    if (targetIndex < 0 || targetIndex >= (session.question_count || 0)) return;
    if (targetIndex === currentIndex) {
      setShowNavPopup(false);
      return;
    }
    setShowNavPopup(false);

    // Save current answer before navigating (if any)
    if (selectedAnswer && currentQuestion) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      await submitSecureAnswer(player.id, currentQuestion.id, selectedAnswer, timeTaken, currentIndex);
      const updated = [...localAnswers];
      updated[currentIndex] = selectedAnswer;
      setLocalAnswers(updated);
    }

    setSelectedAnswer(null);
    setCurrentIndex(targetIndex);
    setCurrentQuestion(null); // Trigger JIT load
    secureSave(`quiz_index_${quizCode}`, targetIndex.toString());
    setStartTime(Date.now());
  };

  // Standard mode: finish quiz (submit all remaining)
  const finishStandardQuiz = async () => {
    if (!player || isFinished) return;
    // Save current answer if any
    if (selectedAnswer && currentQuestion) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      await submitSecureAnswer(player.id, currentQuestion.id, selectedAnswer, timeTaken, currentIndex);
    }
    await finishPlayerQuiz(player.id);
    secureRemove(`quiz_index_${quizCode}`);
    secureRemove(`quiz_player_${quizCode}`);
    setIsFinished(true);
    router.replace(`/quiz/${quizCode}`);
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">LOADING...</div>;
  if (!session) return null;

  if (isFinished) {
    return (
      <div className="flex-1 flex flex-col px-6 pt-6 pb-12 md:pt-8 md:pb-16 bg-white min-h-screen">
        <div className="max-w-3xl mx-auto w-full">
          <div className="mb-12 border-b border-nike-black pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-[48px] sm:text-[64px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-2 flex flex-wrap items-baseline gap-4">
                <span>Leaderboard.</span>
              </h2>
              <p className="text-[20px] font-bold text-nike-black uppercase mb-1">{session.mapel} · {session.bab} · {session.sub_bab}</p>
              <p className="text-[16px] font-medium text-nike-grey-500 uppercase">
                {player && (
                  <>
                    SKOR KAMU: <span className="font-bold text-nike-black">{score} / {session.question_count}</span>
                  </>
                )}
              </p>
            </div>
            <div>
              <span className="inline-block px-4 py-2 bg-nike-black text-nike-white text-[12px] font-bold uppercase rounded-[30px]">Live Result</span>
            </div>
          </div>

          <div className="space-y-4 mb-12">
            {leaderboard.map((lb, idx) => (
              <div key={lb.id} className={`p-6 sm:p-8 rounded-[20px] flex justify-between items-center ${lb.id === player?.id ? 'bg-nike-black text-nike-white' : 'bg-nike-grey-100 text-nike-black'}`}>
                <div className="flex items-center gap-4">
                  <span className={`font-display text-[24px] shrink-0 ${lb.id === player?.id ? 'text-nike-grey-300' : 'text-nike-grey-400'}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                  <span className="font-bold text-[18px] sm:text-[20px] leading-tight flex-1">{lb.name}</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="font-bold text-[16px] uppercase">{lb.score} Benar</span>
                  <span className={`text-[12px] font-medium uppercase tracking-widest ${lb.id === player?.id ? 'text-nike-grey-300' : 'text-nike-grey-500'}`}>{lb.total_time}s</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-nike-grey-200 pt-8">
            <button
              onClick={() => router.push('/')}
              className="w-full sm:w-auto px-12 h-[60px] rounded-[30px] bg-white border-[1.5px] border-nike-grey-300 text-nike-black text-[16px] font-medium hover:bg-nike-grey-100 transition-colors uppercase tracking-wider"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white">
        <div className="text-center max-w-sm w-full">
          <p className="text-[14px] font-black text-nike-black uppercase tracking-[0.3em] mb-4">Live Quiz</p>

          <div className="mb-8 flex flex-col gap-3">
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Mapel</p>
              <p className="text-[13px] font-bold text-gray-800 uppercase">{session.mapel?.replace(/_/g, ' ') || '-'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Bab</p>
              <p className="text-[13px] font-bold text-gray-800 uppercase">{session.bab?.replace(/_/g, ' ') || '-'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Subbab</p>
              <p className="text-[13px] font-bold text-gray-800 uppercase">{session.sub_bab?.replace(/_/g, ' ') || '-'}</p>
            </div>
          </div>

          <h2 className="font-display text-[48px] sm:text-[64px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-8">Join.</h2>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="MASUKKAN NAMA KAMU"
              value={name}
              onChange={e => setName(e.target.value.toUpperCase())}
              className="w-full text-center text-[16px] font-bold py-5 rounded-[24px] border-2 border-gray-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 focus:outline-none mb-2 uppercase tracking-widest transition-all shadow-sm"
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim() || loading}
              className="w-full h-[64px] rounded-[32px] bg-nike-black text-nike-white text-[16px] font-black uppercase tracking-widest hover:bg-nike-grey-500 transition-all disabled:opacity-20 active:scale-[0.98] shadow-xl shadow-nike-black/20"
            >
              {loading ? 'MENYAMBUNGKAN...' : 'MASUK RUANG TUNGGU'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white">
        <div className="text-center max-w-sm w-full">
          <h2 className="font-display text-[32px] sm:text-[48px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-1">Menunggu Admin</h2>
          <p className="text-[14px] font-black text-nike-black uppercase tracking-[0.3em] mb-10">Ruang Tunggu</p>

          <div className="w-16 h-16 border-[4px] border-gray-100 border-t-nike-black rounded-full animate-spin mx-auto mb-6"></div>

          <p className="text-[12px] font-bold text-nike-grey-300 uppercase tracking-[0.2em] mb-10">Kuis akan segera dimulai</p>

          {waitTimer && (
            <div className="mb-10 -mt-6 bg-nike-black rounded-2xl py-3 px-8 inline-block animate-in fade-in zoom-in duration-300">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] block mb-1">Mulai Otomatis Dalam</span>
              <span className="text-[28px] font-black font-mono text-white leading-none tabular-nums">{waitTimer}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Mapel</p>
              <p className="text-[13px] font-bold text-gray-800 uppercase">{session.mapel?.replace(/_/g, ' ') || '-'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Bab</p>
              <p className="text-[13px] font-bold text-gray-800 uppercase">{session.bab?.replace(/_/g, ' ') || '-'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Subbab</p>
              <p className="text-[13px] font-bold text-gray-800 uppercase">{session.sub_bab?.replace(/_/g, ' ') || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Quiz Playing
  const q = currentQuestion;
  if (!q) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-screen p-6">
        {loadError ? (
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="font-display text-[32px] text-nike-black uppercase mb-4">WADUH!</h2>
            <p className="text-nike-grey-500 font-bold uppercase tracking-widest text-sm mb-8 max-w-xs mx-auto">{loadError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-nike-black text-white rounded-full font-black text-sm uppercase tracking-widest hover:bg-nike-grey-500 transition-all shadow-xl shadow-nike-black/20"
            >
              SEGARKAN HALAMAN
            </button>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 border-4 border-nike-black border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-nike-grey-500 font-bold uppercase tracking-widest text-sm">Menyiapkan Soal...</p>
          </>
        )}
      </div>
    );
  }

  const textLength = q.question_text.replace(/<[^>]*>/g, '').length;
  const fontSizeClass = textLength > 500 ? 'text-[14px] md:text-[18px]' :
    textLength > 250 ? 'text-[16px] md:text-[22px]' :
      'text-[18px] md:text-[28px]';

  return (
    <div className="flex-1 flex flex-col px-6 pt-6 pb-12 md:pt-8 md:pb-16 min-h-screen bg-white relative">
      {session.status === 'paused' && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-md z-[9999] flex items-center justify-center animate-in fade-in duration-300">
          <div className="text-center p-12 bg-white/80 rounded-[40px] shadow-2xl border border-white/50">
            <div className="w-24 h-24 bg-nike-black rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-lg">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            </div>
            <h1 className="font-display text-[48px] sm:text-[64px] text-nike-black leading-none tracking-tight uppercase mb-4">PAUSED</h1>
            <p className="text-nike-grey-500 font-bold text-sm tracking-[0.2em] uppercase">Kuis sedang dijeda oleh admin</p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Progress & Status */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 pb-4 border-b border-nike-grey-200 gap-4">
          <div className="flex flex-col">
            <span className="text-[17px] font-bold text-nike-black uppercase tracking break-words">
              {player.name}
            </span>
            <div className="flex flex-col gap-0.5 mt-2">
              <span className="text-[12px] font-medium text-nike-grey-500 uppercase tracking-tight">{session.mapel}</span>
              <span className="text-[12px] font-medium text-nike-grey-500 uppercase tracking-tight">{session.bab}</span>
              <span className="text-[12px] font-medium text-nike-grey-500 uppercase tracking-tight">{session.sub_bab}</span>
              <span className="text-[13px] font-black text-nike uppercase tracking-widest mt-1.5">SOAL NOMOR {currentIndex + 1}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {timeLeftDisplay && (
              <div className="flex items-center gap-2 bg-nike-grey-100 px-4 py-2 rounded-full border border-nike-grey-200 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-nike-red animate-pulse"></div>
                <span className="text-[14px] font-black font-mono text-nike-black">{timeLeftDisplay}</span>
              </div>
            )}

            {/* Standard Mode: Navigation Grid Button */}
            {isStandard && (
              <button
                onClick={() => setShowNavPopup(true)}
                className="w-10 h-10 rounded-[12px] bg-nike-grey-100 border border-nike-grey-200 flex items-center justify-center hover:bg-nike-grey-200 transition-colors shadow-sm"
                title="Navigasi Soal"
              >
                <svg className="w-5 h-5 text-nike-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            <div className="sm:text-right">
              {selectedAnswer && selectedAnswer.trim().length > 0 ? (
                <span className="text-[14px] font-bold text-nike-green uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full">
                  Answer Selected
                </span>
              ) : (
                <span className="text-[14px] font-bold text-nike-grey-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">
                  Pending Response
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Question Display Layout */}
        <div className="mb-0 h-auto md:h-[min(65vh,620px)] md:min-h-[420px] overflow-y-auto md:overflow-hidden border border-nike-grey-200 rounded-[24px] bg-white shadow-sm flex flex-col">
          <div className="flex flex-col md:grid md:h-full md:grid-cols-[70%_1px_1fr] flex-1">
            <div className="h-auto md:h-full overflow-visible md:overflow-y-auto scrollbar-stable p-6 md:p-10 flex flex-col pt-6 md:pt-12 border-b md:border-b-0 border-nike-grey-100 flex-1 min-w-0">
              <RichContent
                html={q.question_text}
                className={`exam-question-content ${fontSizeClass} font-bold text-nike-black leading-[1.25] tracking-tight`}
              />
            </div>

            <div className="hidden md:flex items-center">
              <div className="w-px h-[85%] bg-nike-grey-200" aria-hidden="true" />
            </div>

            <div className="flex-1 h-auto md:h-full overflow-visible md:overflow-y-auto scrollbar-stable p-6 md:p-10 flex flex-col justify-center bg-nike-grey-50 md:bg-white min-w-0">
              {q.question_type === 'short_answer' ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold uppercase tracking-widest text-nike-grey-500">Jawaban Singkat</p>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-nike-grey-400">Text / Angka</span>
                  </div>
                  <input
                    type="text"
                    value={selectedAnswer ?? ''}
                    onChange={(event) => setSelectedAnswer(event.target.value)}
                    placeholder="Ketik jawaban di sini..."
                    className="w-full rounded-[16px] border-[1.5px] border-nike-grey-200 bg-white px-4 py-3 text-[15px] font-medium text-nike-black focus:border-nike-black focus:outline-none focus:ring-4 focus:ring-nike-black/5 transition-all"
                  />
                  <p className="text-[11px] text-nike-grey-400 uppercase tracking-widest">Tekan Next untuk lanjut.</p>
                </div>
              ) : (
                <div className="grid grid-rows-5 gap-1.5 w-full">
                  {q.options.map((opt, i) => {
                    const prefix = opt.label;
                    const isSelected = selectedAnswer === opt.text;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedAnswer(opt.text)}
                    className={`w-full min-w-0 group flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-[12px] text-left transition-all duration-200 border-[1.5px] ${isSelected
                            ? 'bg-nike-black border-nike-black text-nike-white'
                            : 'bg-white border-nike-grey-200 text-nike-black hover:border-nike-black hover:bg-nike-grey-100'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 w-full min-w-0">
                          <span className={`font-display shrink-0 text-[15px] md:text-[17px] transition-colors ${isSelected ? 'text-nike-grey-300' : 'text-nike-grey-500 group-hover:text-nike-black'}`}>
                            {prefix}
                          </span>
                          <div className="w-px h-4 shrink-0 bg-nike-grey-200 group-hover:bg-nike-grey-300 transition-colors" />
                          <RichContent
                            html={opt.text}
                            className={`exam-option-content flex-1 min-w-0 text-[14px] md:text-[15px] font-medium tracking-tight leading-snug ${isSelected ? 'text-nike-white' : 'text-nike-black'}`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-nike-grey-200 pt-8 mt-6">
          {isStandard ? (
            /* Standard Mode: Back / Doubt / Next */
            <>
              <button
                onClick={() => goToQuizQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black text-[16px] font-medium hover:bg-nike-grey-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                ◀ Back
              </button>
              <button
                onClick={() => {
                  const updated = [...doubtFlags];
                  updated[currentIndex] = !updated[currentIndex];
                  setDoubtFlags(updated);
                }}
                className={`w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] text-[16px] font-medium transition-all uppercase tracking-wider border-[1.5px] ${
                  doubtFlags[currentIndex]
                    ? 'bg-yellow-400 border-yellow-400 text-nike-black shadow-lg shadow-yellow-400/20'
                    : 'bg-transparent border-nike-grey-300 text-nike-grey-500 hover:border-yellow-400 hover:text-yellow-600'
                }`}
              >
                🤔 Ragu-ragu
              </button>
              <button
                onClick={() => {
                  if (currentIndex >= (session?.question_count || 0) - 1) {
                    finishStandardQuiz();
                  } else {
                    goToQuizQuestion(currentIndex + 1);
                  }
                }}
                className="w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors uppercase tracking-wider"
              >
                {currentIndex >= (session?.question_count || 0) - 1 ? 'Finish' : 'Next ▶'}
              </button>
            </>
          ) : (
            /* Strict Mode: original buttons */
            <>
              <button
                onClick={() => handleAnswer(selectedAnswer)}
                disabled={!selectedAnswer || selectedAnswer.trim().length === 0}
                className="w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Next Question
              </button>
              <button
                onClick={() => handleAnswer(null)}
                className="w-full sm:w-auto px-8 h-[60px] rounded-[30px] bg-transparent text-nike-grey-500 text-[16px] font-medium hover:text-nike-black transition-colors uppercase tracking-wider"
              >
                Skip
              </button>
            </>
          )}
        </div>

        {/* Standard Mode: Navigation Popup */}
        {isStandard && showNavPopup && (
          <div className="fixed inset-0 z-[100] bg-nike-white/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] max-w-md w-full border border-nike-grey-200 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-[28px] text-nike-black leading-none uppercase">Navigasi</h3>
                  <button
                    onClick={() => setShowNavPopup(false)}
                    className="w-10 h-10 rounded-full bg-nike-grey-100 flex items-center justify-center hover:bg-nike-grey-200 transition-colors"
                  >
                    <svg className="w-5 h-5 text-nike-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-4 mb-4 text-[10px] font-bold uppercase tracking-widest text-nike-grey-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-nike-black"></span> Terjawab</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-400"></span> Ragu-ragu</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-nike-grey-300"></span> Kosong</span>
                </div>
              </div>
              <div className="px-8 pb-8 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {Array.from({ length: session?.question_count || 0 }, (_, i) => {
                    const isAnswered = localAnswers[i] !== null && localAnswers[i] !== undefined && String(localAnswers[i]).trim().length > 0;
                    const isDoubt = doubtFlags[i] || false;
                    const isCurrent = i === currentIndex;
                    return (
                      <button
                        key={i}
                        onClick={() => goToQuizQuestion(i)}
                        className={`h-10 rounded-[10px] text-[13px] font-black transition-all border-2 ${
                          isCurrent ? 'ring-2 ring-[#4A90D9] ring-offset-2' : ''
                        } ${
                          isDoubt
                            ? 'bg-yellow-400 border-yellow-400 text-nike-black'
                            : isAnswered
                              ? 'bg-nike-black border-nike-black text-white'
                              : 'bg-white border-nike-grey-200 text-nike-black hover:border-nike-black'
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Anti-Cheat: Tab Warning Modal */}
      <TabWarningModal
        warningCount={warningCount}
        isOpen={showWarningModal}
        onDismiss={dismissWarning}
      />
    </div>
  );
}
