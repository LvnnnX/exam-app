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
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerData | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
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
        void submitSecureAnswer(player.id, q.id, answerText, timeTaken);
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
        supabase.from('player').select('*').eq('id', savedPlayerId).single().then(({ data }) => {
          if (data) {
            // Rule 4 & 5: Strict check for completion state on mount
            if (data.finished_at) {
              setIsFinished(true);
              return;
            }
            setPlayer(data);
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
    const { data } = await supabase.from('player').select('*').eq('kuis_id', kuisId).order('score', { ascending: false }).order('total_time', { ascending: true });
    if (data) setLeaderboard(data);
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
    setLoading(false);
  };

  const loadQuestion = useCallback(async (index: number) => {
    if (!player) return;
    setLoading(true);
    const qData = await getJitQuestion(player.id, index);
    if (qData) {
      setCurrentQuestion(qData);
    }
    setLoading(false);
  }, [player]);

  useEffect(() => {
    if (session?.status === 'active' && player && !isFinished && !currentQuestion && !loading) {
      loadQuestion(currentIndex);
    }
  }, [session?.status, player, isFinished, currentIndex, currentQuestion, loading, loadQuestion]);

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
      await submitSecureAnswer(player.id, q.id, answerText, timeTaken);
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

  const handleAnswer = async (opt: AnswerData | null) => {
    if (!player || !session || isFinished) return;

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    if (!currentQuestion) return;
    const answerText = opt || '';

    const result = await submitSecureAnswer(player.id, currentQuestion.id, answerText, timeTaken);
    const isCorrect = result.success ? result.is_correct : false;

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
              <p className="text-[20px] font-bold text-nike-black uppercase mb-1">{session.bab}, {session.sub_bab}</p>
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
          <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-widest mb-1">Live Quiz</p>
          <p className="text-[11px] font-bold text-nike-grey-400 uppercase tracking-[0.2em] mb-3">Topik : {session.bab?.replace(/_/g, ' ')}, {session.sub_bab?.replace(/_/g, ' ')}</p>
          <h2 className="font-display text-[48px] sm:text-[64px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-8">Join</h2>

          <input
            type="text"
            placeholder="NAMA KAMU"
            value={name}
            onChange={e => setName(e.target.value.toUpperCase())}
            className="w-full text-center text-[16px] font-bold py-4 rounded-[30px] border-[1.5px] border-nike-grey-200 focus:border-nike-black focus:outline-none mb-6 uppercase tracking-wider transition-colors"
          />
          <button
            onClick={handleJoin}
            disabled={!name.trim() || loading}
            className="w-full h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 uppercase tracking-wider"
          >
            {loading ? 'MENYAMBUNGKAN...' : 'MASUK RUANG TUNGGU'}
          </button>
        </div>
      </div>
    );
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-nike-grey-200 border-t-nike-black rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-widest mb-1">Ruang Tunggu</p>
          <p className="text-[11px] font-bold text-nike-grey-400 uppercase tracking-[0.2em] mb-3">Topik : {session.bab?.replace(/_/g, ' ')}, {session.sub_bab?.replace(/_/g, ' ')}</p>
          <h2 className="font-display text-[32px] sm:text-[48px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-2">Menunggu Admin</h2>
          <p className="text-[12px] text-nike-grey-300 uppercase tracking-[0.2em]">Kuis akan segera dimulai</p>
        </div>
      </div>
    );
  }

  // Active Quiz Playing
  const q = currentQuestion;
  if (!q) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-screen">
        <div className="w-16 h-16 border-4 border-nike-black border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-nike-grey-500 font-bold uppercase tracking-widest text-sm">Menyiapkan Soal...</p>
      </div>
    );
  }

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
            <span className="text-[12px] font-medium text-nike-grey-400 uppercase tracking-widest mb-1">
              Topik: {session.bab}, {session.sub_bab}
            </span>
            <span className="text-[16px] font-bold text-nike-grey-400 uppercase tracking-widest mb-1">
              Soal Nomor {currentIndex + 1}
            </span>
          </div>

          <div className="flex items-center gap-6">
            {timeLeftDisplay && (
              <div className="flex items-center gap-2 bg-nike-grey-100 px-4 py-2 rounded-full border border-nike-grey-200 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-nike-red animate-pulse"></div>
                <span className="text-[14px] font-black font-mono text-nike-black">{timeLeftDisplay}</span>
              </div>
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
                className="exam-question-content text-[18px] md:text-[28px] font-bold text-nike-black leading-[1.25] tracking-tight"
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
                <div className="grid grid-rows-5 gap-3 w-full">
                  {q.options.map((opt, i) => {
                    const prefix = opt.label;
                    const isSelected = selectedAnswer === opt.text;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedAnswer(opt.text)}
                        className={`w-full min-w-0 group flex items-center p-4 md:p-5 rounded-[16px] text-left transition-all duration-200 border-[1.5px] ${isSelected
                            ? 'bg-nike-black border-nike-black text-nike-white'
                            : 'bg-white border-nike-grey-200 text-nike-black hover:border-nike-black hover:bg-nike-grey-100'
                          }`}
                      >
                        <div className="flex items-center gap-4 w-full min-w-0">
                          <span className={`font-display shrink-0 text-[18px] md:text-[20px] transition-colors ${isSelected ? 'text-nike-grey-300' : 'text-nike-grey-500 group-hover:text-nike-black'}`}>
                            {prefix}
                          </span>
                          <div className="w-px h-6 shrink-0 bg-nike-grey-200 group-hover:bg-nike-grey-300 transition-colors" />
                          <RichContent
                            html={opt.text}
                            className={`exam-option-content flex-1 min-w-0 text-[15px] md:text-[17px] font-medium tracking-tight leading-tight ${isSelected ? 'text-nike-white' : 'text-nike-black'}`}
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
        </div>
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
