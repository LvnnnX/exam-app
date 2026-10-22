'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Quiz, QuizQuestionJit } from '../types';
import {
  getQuizQuestionAction,
  submitQuizAnswerAction,
  finishQuizPlayerAction,
} from '../actions';
import {
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Flag,
  ShieldAlert,
} from 'lucide-react';

function getNowTimestamp(): number {
  return Date.now();
}

interface StudentQuizRuntimeProps {
  quiz: Quiz;
  playerId: string;
  playerName: string;
  onFinished: () => void;
}

export default function StudentQuizRuntime({
  quiz,
  playerId,
  playerName: _playerName,
  onFinished,
}: StudentQuizRuntimeProps) {
  const isStrict = quiz.config?.quiz_mode === 'strict';
  const totalQuestions = quiz.config?.question_count || 10;

  // Question & Navigation states
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestionJit | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState<boolean>(true);
  const [answersMap, setAnswersMap] = useState<Record<number, string>>({});
  const [doubtMap, setDoubtMap] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Timing states
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const questionStartTimeRef = useRef<number>(0);

  // Anti-cheat states (KL-16)
  const [_violationCount, setViolationCount] = useState<number>(0);
  const [showViolationModal, setShowViolationModal] = useState<boolean>(false);

  // 1. Wake Lock API (KL-16)
  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as unknown as { wakeLock: { request: (s: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
        }
      } catch {
        // WakeLock not supported or denied
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) {
        try { void wakeLock.release(); } catch {}
      }
    };
  }, []);

  // 2. Tab switch detection (KL-16)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationCount((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setShowViolationModal(true);
            // Auto submit and finish
            finishQuizPlayerAction(playerId).then(() => {
              setTimeout(onFinished, 2500);
            });
          } else {
            alert(`Peringatan Anti-Curang: Dilarang berpindah tab saat kuis berlangsung! (${next}/3)`);
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [playerId, onFinished]);

  // 3. Countdown Timer based on expires_at
  useEffect(() => {
    if (!quiz.expires_at) return;

    const updateTimer = () => {
      const diffMs = new Date(quiz.expires_at!).getTime() - Date.now();
      const sec = Math.max(0, Math.floor(diffMs / 1000));
      setTimeLeftSec(sec);

      if (sec <= 0) {
        // Time expired! Auto-finish
        finishQuizPlayerAction(playerId).then(() => {
          onFinished();
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [quiz.expires_at, playerId, onFinished]);

  // 4. Fetch question JIT (KL-12)
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingQuestion(true);
      setErrorMsg(null);
      try {
        const res = await getQuizQuestionAction(playerId, currentIndex);
        if (!cancelled) {
          if (res.success && res.question) {
            setCurrentQuestion(res.question);
            questionStartTimeRef.current = getNowTimestamp();
          } else {
            setErrorMsg(res.error || 'Gagal memuat soal');
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoadingQuestion(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [playerId, currentIndex, retryTrigger]);

  // 5. Handle Answer Selection & Submission (KL-13)
  const handleSelectOption = async (optionId: string) => {
    if (!currentQuestion) return;
    setAnswersMap((prev) => ({ ...prev, [currentIndex]: optionId }));

    const timeTaken = Math.max(1, Math.round((getNowTimestamp() - questionStartTimeRef.current) / 1000));

    // Submit answer to server immediately
    setIsSubmitting(true);
    try {
      await submitQuizAnswerAction(
        playerId,
        currentIndex,
        currentQuestion.id,
        optionId,
        timeTaken
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Last question reached
      handleFinalFinish();
    }
  };

  const handlePrev = () => {
    if (!isStrict && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const toggleDoubt = () => {
    setDoubtMap((prev) => ({ ...prev, [currentIndex]: !prev[currentIndex] }));
  };

  const handleFinalFinish = async () => {
    if (confirm('Apakah Anda yakin ingin menyelesaikan kuis ini?')) {
      setIsSubmitting(true);
      try {
        await finishQuizPlayerAction(playerId);
        onFinished();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const selectedAnswer = answersMap[currentIndex] || '';
  const isDoubt = Boolean(doubtMap[currentIndex]);

  return (
    <div
      className="w-full max-w-3xl mx-auto flex flex-col gap-5 select-none"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Header: Timer & Anti-Cheat badge */}
      <div className="p-4 rounded-3xl glass-card border border-line flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold font-mono px-3 py-1 rounded-full well border border-line text-primary">
            Soal {currentIndex + 1} dari {totalQuestions}
          </span>
          {isStrict && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full well border border-line text-amber-600">
              Mode Strict
            </span>
          )}
        </div>

        {/* Timer */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border font-mono font-bold text-sm ${
            timeLeftSec <= 60
              ? 'bg-danger/15 border-danger/40 text-danger animate-pulse'
              : 'well border-line text-fg'
          }`}
        >
          <Clock size={16} />
          <span>{formatTimer(timeLeftSec)}</span>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="p-6 sm:p-8 rounded-3xl glass-card border border-line shadow-sm flex flex-col gap-6">
        {loadingQuestion ? (
          <div className="py-16 text-center text-xs text-fg-subtle animate-pulse">
            Memuat soal nomor {currentIndex + 1}...
          </div>
        ) : errorMsg ? (
          <div className="py-12 text-center text-xs text-danger flex flex-col items-center gap-2">
            <AlertTriangle size={24} />
            <span>{errorMsg}</span>
            <button
              onClick={() => setRetryTrigger((v) => v + 1)}
              className="mt-2 px-4 py-2 rounded-2xl bg-primary text-white text-xs font-bold"
            >
              Coba Lagi
            </button>
          </div>
        ) : currentQuestion ? (
          <>
            {/* Question Body */}
            <div className="flex flex-col gap-3">
              <div
                className="text-sm sm:text-base text-fg leading-relaxed font-medium prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: currentQuestion.body_html }}
              />
            </div>

            {/* Options List */}
            <div className="flex flex-col gap-3 pt-2">
              {currentQuestion.type === 'short_answer' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-fg-subtle">Jawaban Isian Singkat:</label>
                  <input
                    type="text"
                    value={selectedAnswer}
                    onChange={(e) => handleSelectOption(e.target.value)}
                    placeholder="Ketik jawaban Anda..."
                    className="w-full px-4 py-3 rounded-2xl well border border-line text-sm font-semibold text-fg focus:outline-hidden focus:border-primary"
                  />
                </div>
              ) : (
                currentQuestion.options?.map((opt: Record<string, unknown>, idx: number) => {
                  const optId = (opt.id as string) || String.fromCharCode(65 + idx);
                  const isChecked = selectedAnswer === optId;
                  const labelLetter = String.fromCharCode(65 + idx);
                  return (
                    <button
                      key={optId}
                      type="button"
                      onClick={() => handleSelectOption(optId)}
                      className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all text-left ${
                        isChecked
                          ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30 font-semibold'
                          : 'border-line glass hover:bg-well'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                          isChecked
                            ? 'bg-primary text-white border-primary clay-primary'
                            : 'well border-line text-fg-subtle'
                        }`}
                      >
                        {labelLetter}
                      </span>
                      <span className="text-xs sm:text-sm text-fg pt-0.5 leading-relaxed">
                        {String(opt.text || opt.label || '')}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : null}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-5 border-t border-line mt-2">
          {!isStrict ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-3.5 py-2 rounded-2xl well hover:bg-well/80 border border-line text-xs font-bold text-fg flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </button>

              <button
                type="button"
                onClick={toggleDoubt}
                className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  isDoubt
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600'
                    : 'well border-line text-fg-subtle hover:text-amber-600'
                }`}
              >
                <Flag size={14} />
                <span>{isDoubt ? 'Ragu-ragu' : 'Tandai Ragu'}</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {currentIndex + 1 < totalQuestions ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isStrict && !selectedAnswer}
                className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>Selanjutnya</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalFinish}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl bg-success text-white text-xs font-bold clay-success hover:opacity-95 transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={16} />
                <span>Selesaikan Kuis</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Standard Mode: Question Numbers Grid Palette */}
      {!isStrict && (
        <div className="p-4 sm:p-5 rounded-3xl glass-card border border-line shadow-2xs flex flex-col gap-3">
          <span className="text-xs font-bold text-fg-subtle uppercase tracking-wider block">
            Daftar Nomor Soal
          </span>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: totalQuestions }).map((_, idx) => {
              const answered = Boolean(answersMap[idx]);
              const active = currentIndex === idx;
              const doubt = Boolean(doubtMap[idx]);
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-9 h-9 rounded-xl font-mono text-xs font-bold border flex items-center justify-center transition-all ${
                    active
                      ? 'border-primary ring-2 ring-primary/40 bg-primary text-white clay-primary'
                      : doubt
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700'
                      : answered
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'well border-line text-fg-subtle hover:bg-well/80'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Anti-cheat violation modal */}
      {showViolationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl glass-card border border-danger/40 p-6 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-danger/20 text-danger flex items-center justify-center">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h3 className="font-bold text-fg text-base">Diskualifikasi Anti-Curang</h3>
              <p className="text-xs text-fg-subtle mt-1.5 leading-relaxed">
                Anda telah berpindah tab atau meninggalkan aplikasi sebanyak 3 kali. Sesi pengerjaan kuis Anda telah dihentikan secara otomatis.
              </p>
            </div>
            <p className="text-xs text-danger font-semibold animate-pulse">
              Mengalihkan ke hasil kuis...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
