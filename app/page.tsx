"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import QuestionDisplay from '@/app/components/QuestionDisplay';
import RichContent from '@/app/components/RichContent';
import {
  type ShuffledQuestion,
  type QuestionCount,
  type CategoryInfo,
  QUESTION_COUNTS,
  fetchCategories,
  startExamSessionViaRpc,
  getSessionQuestionViaRpc,
  getSessionStateViaRpc,
  saveSessionAnswerViaRpc,
  submitSessionExamViaRpc,
} from '@/lib/questions';
import { secureSave, secureLoad, secureClear, secureRemove } from '@/lib/security';

type Answer = string | null;
type GameMode = 'exam' | 'survival';

const PREPARING_STEP = 25;

// Local Storage keys
const STORAGE_KEYS = {
  NAME: 'exam_name',
  STEP: 'exam_step',
  CURRENT: 'exam_current',
  ANSWERS: 'exam_answers',
  SESSION_ID: 'exam_session_id',
  TOTAL: 'exam_total_questions',
  CATEGORY: 'exam_category',
  START_TIME: 'exam_start_time',
  MODE: 'exam_mode',
  LIVES: 'exam_lives',
  EXPIRES_AT: 'exam_expires_at',
  TIME_LIMIT: 'exam_time_limit',
};

const TIME_LIMIT_OPTIONS = [
  { label: 'No Time', value: 0 },
  { label: '30 Minutes', value: 30 },
  { label: '60 Minutes', value: 60 },
  { label: '90 Minutes', value: 90 },
  { label: '120 Minutes', value: 120 },
];

export default function ExamPage() {
  // App state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<CategoryInfo[]>([]);
  const [questionCount, setQuestionCount] = useState<QuestionCount>(20);
  const [step, setStep] = useState(1); // 1=Name, 2=Confirm, 25=Preparing, 3=Quiz, 6=Score, 7=Results
  const [current, setCurrent] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<ShuffledQuestion | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [score, setScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>('exam');
  const [saveFailed, setSaveFailed] = useState(false);

  const [lives, setLives] = useState(3);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<'correct' | 'wrong' | null>(null);
  const [recapData, setRecapData] = useState<any[]>([]);
  const [timeLimit, setTimeLimit] = useState<number>(0); // in minutes, 0 = No Time
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState<string>('');
  const isSurvival = gameMode === 'survival';

  const total = totalQuestions;
  const hasAnswerSelected = total > 0 && answers[current] !== undefined && answers[current] !== null;

  // ==================== SCORE CALCULATION ====================
  // Score is now calculated securely on the server via RPC.
  // Local score state is updated by the server response.

  // ==================== LOCAL STORAGE FUNCTIONS ====================

  const saveNameToStorage = (userName: string) => {
    secureSave(STORAGE_KEYS.NAME, userName);
  };

  const saveStepToStorage = (stepValue: number) => {
    secureSave(STORAGE_KEYS.STEP, stepValue);
  };

  const saveCurrentQuestionToStorage = (questionIndex: number) => {
    secureSave(STORAGE_KEYS.CURRENT, questionIndex);
  };

  const saveAnswersToStorage = (answersArray: Answer[]) => {
    secureSave(STORAGE_KEYS.ANSWERS, answersArray);
  };

  const saveSessionIdToStorage = (id: string) => {
    secureSave(STORAGE_KEYS.SESSION_ID, id);
  };

  const saveTotalQuestionsToStorage = (count: number) => {
    secureSave(STORAGE_KEYS.TOTAL, count);
  };

  const saveCategoryToStorage = (cat: string) => {
    secureSave(STORAGE_KEYS.CATEGORY, cat);
  };

  const saveStartTimeToStorage = (time: number) => {
    secureSave(STORAGE_KEYS.START_TIME, time);
  };

  const saveModeToStorage = (m: GameMode) => {
    secureSave(STORAGE_KEYS.MODE, m);
  };

  const saveLivesToStorage = (l: number) => {
    secureSave(STORAGE_KEYS.LIVES, l);
  };

  const loadFromStorage = () => {
    return {
      name: secureLoad<string>(STORAGE_KEYS.NAME),
      step: secureLoad<number>(STORAGE_KEYS.STEP),
      current: secureLoad<number>(STORAGE_KEYS.CURRENT),
      answers: secureLoad<Answer[]>(STORAGE_KEYS.ANSWERS),
      sessionId: secureLoad<string>(STORAGE_KEYS.SESSION_ID),
      total: secureLoad<number>(STORAGE_KEYS.TOTAL) || 0,
      category: secureLoad<string>(STORAGE_KEYS.CATEGORY),
      startTime: secureLoad<number>(STORAGE_KEYS.START_TIME),
      mode: secureLoad<GameMode>(STORAGE_KEYS.MODE) || 'exam',
      lives: secureLoad<number>(STORAGE_KEYS.LIVES) || 3,
      expiresAt: secureLoad<string>(STORAGE_KEYS.EXPIRES_AT),
      timeLimit: secureLoad<number>(STORAGE_KEYS.TIME_LIMIT) || 0,
    };
  };

  const saveExpiresAtToStorage = (val: string) => {
    secureSave(STORAGE_KEYS.EXPIRES_AT, val);
  };

  const saveTimeLimitToStorage = (val: number) => {
    secureSave(STORAGE_KEYS.TIME_LIMIT, val);
  };

  const clearStorage = () => {
    secureClear();
  };

  // ==================== RESTORE STATE ON MOUNT ====================

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = loadFromStorage();

    // Prioritize session restore if ID exists
    if (stored.sessionId) {
      setIsLoading(true);
      getSessionStateViaRpc(stored.sessionId).then(state => {
        if (!state || state.is_finished) {
          // No active session or finished -> show start screen
          if (stored.name) setName(stored.name);
          setIsRestored(true);
          setIsLoading(false);
          return;
        }

        // Restore everything from Server State
        setName(state.name);
        setSessionId(stored.sessionId!);
        setTotalQuestions(state.question_count);
        setCurrent(state.current_index);
        setStep(state.current_index >= state.question_count ? 6 : 3);
        setCategory(state.category);
        setGameMode(state.mode);
        setLives(state.lives);
        setExpiresAt(state.expires_at);
        saveExpiresAtToStorage(state.expires_at);
        if (stored.startTime) setStartTime(stored.startTime);

        // Map user_answers to local state
        const newAnswers = Array(state.question_count).fill(null);
        if (state.user_answers) {
          Object.keys(state.user_answers).forEach(k => {
            newAnswers[parseInt(k)] = state.user_answers[k];
          });
        }
        setAnswers(newAnswers);

        // Fetch current question data
        getSessionQuestionViaRpc(stored.sessionId!, state.current_index).then(q => {
          setCurrentQuestion(q);
        }).finally(() => {
          setIsRestored(true);
          setIsLoading(false);
        });
      }).catch(e => {
        console.error('Session restore failed:', e);
        setIsRestored(true);
        setIsLoading(false);
      });
    } else if (stored.name) {
      setName(stored.name);
      setIsRestored(true);
    } else {
      setIsRestored(true);
    }

    // Fetch dynamic categories helper
    const loadCategories = async () => {
      try {
        setFetchError(null);
        const data = await fetchCategories();
        if (data.length === 0) {
          console.warn("No categories found in Supabase.");
        }
        setAvailableCategories(data);
      } catch (err: any) {
        console.error("Failed to load categories:", err);
        setFetchError(err.message || "Failed to connect to server");
      }
    };

    loadCategories();
    (window as any).__retryCategoryFetch = loadCategories;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ==================== FETCH & PREPARE NEW SESSION ====================

  const startNewSession = async () => {
    setIsLoading(true);
    try {
      const count = isSurvival ? 9999 : questionCount;
      const { sessionId: newSessionId, total: newTotal, expiresAt: serverExpiresAt } = await startExamSessionViaRpc(name, category, gameMode, count, timeLimit);

      if (newTotal === 0) {
        throw new Error('Tidak ada soal di kategori ini.');
      }

      setSessionId(newSessionId);
      setTotalQuestions(newTotal);
      setAnswers(Array(newTotal).fill(null));
      setCurrent(0);
      setExpiresAt(serverExpiresAt);

      saveSessionIdToStorage(newSessionId);
      saveTotalQuestionsToStorage(newTotal);
      saveAnswersToStorage(Array(newTotal).fill(null));
      saveCurrentQuestionToStorage(0);
      saveCategoryToStorage(category);
      saveExpiresAtToStorage(serverExpiresAt);
      saveTimeLimitToStorage(timeLimit);

      const firstQuestion = await getSessionQuestionViaRpc(newSessionId, 0);
      setCurrentQuestion(firstQuestion);
    } catch (err: any) {
      console.error('Failed to prepare session:', err);
      alert(err.message || 'Gagal memulai sesi ujian.');
    } finally {
      setIsLoading(false);
    }
  };

  const startExam = async () => {
    saveNameToStorage(name);
    saveModeToStorage(gameMode);
    if (isSurvival) {
      setLives(3);
      saveLivesToStorage(3);
      setScore(0);
    }
    goToStep(PREPARING_STEP);
    await startNewSession();
    const now = Date.now();
    setStartTime(now);
    saveStartTimeToStorage(now);
    goToStep(3);
  };

  // ==================== STATE HANDLERS ====================

  const selectAnswer = (val: string) => {
    const updated = [...answers];
    updated[current] = val;
    setAnswers(updated);
    saveAnswersToStorage(updated);
  };

  const goToStep = (newStep: number) => {
    setStep(newStep);
    saveStepToStorage(newStep);
  };

  const scrollToQuestionTop = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      const mainContainer = document.querySelector('main');
      if (mainContainer instanceof HTMLElement && mainContainer.scrollHeight > mainContainer.clientHeight) {
        mainContainer.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  };

  const endSession = async (skipSave = false) => {
    setIsLoading(true);
    try {
      if (!skipSave) {
        const result = await saveSessionAnswerViaRpc(sessionId!, current, answers[current] || 'skipped');
        if (result && result.error === 'time_expired') {
          // Time expired, auto-submit
          void autoSaveToSupabase();
          return;
        }
      }
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === 'time_expired') {
        void autoSaveToSupabase();
        return;
      }
    } finally {
      setIsLoading(false);
    }

    // Set step to 6 (Score)
    setEndTime(Date.now());
    setStep(6);
  };

  const proceedToNext = async (nextIdx: number, skipSave = false) => {
    setIsLoading(true);
    try {
      if (!skipSave) {
        await saveSessionAnswerViaRpc(sessionId!, current, answers[current] || 'skipped');
      }
      const nextQ = await getSessionQuestionViaRpc(sessionId!, nextIdx);
      setCurrentQuestion(nextQ);
      setCurrent(nextIdx);
      scrollToQuestionTop();
    } catch (e) {
      console.error(e);
      alert('Gagal mengambil soal berikutnya.');
    } finally {
      setIsLoading(false);
    }
  };

  const nextQuestion = async () => {
    if (feedbackResult) return;

    if (isSurvival && currentQuestion) {
      const selectedAnswer = answers[current];

      setIsLoading(true);
      const isCorrect = await saveSessionAnswerViaRpc(sessionId!, current, selectedAnswer || 'skipped');
      setIsLoading(false);

      setFeedbackResult(isCorrect ? 'correct' : 'wrong');

      setTimeout(() => {
        setFeedbackResult(null);
        if (isCorrect) {
          setScore(prev => prev + 1);
        } else {
          const newLives = lives - 1;
          setLives(newLives);
          if (newLives <= 0) {
            void endSession(true);
            return;
          }
        }

        if (current < total - 1) {
          void proceedToNext(current + 1, true);
        } else {
          void endSession(true);
        }
      }, 1500);
      return;
    }

    if (current < total - 1) {
      await proceedToNext(current + 1);
    } else {
      endSession();
    }
  };

  const skipQuestion = async () => {
    if (current < total - 1) {
      await proceedToNext(current + 1);
    } else {
      endSession();
    }
  };

  const surrender = () => {
    endSession();
  };

  const restart = () => {
    setName('');
    setCategory('general_informatics');
    setQuestionCount(20);
    setStep(1);
    setCurrent(0);
    setSessionId(null);
    setCurrentQuestion(null);
    setTotalQuestions(0);
    setAnswers([]);
    setScore(0);
    setStartTime(null);
    setEndTime(null);
    setGameMode('exam');
    setLives(3);
    setSaved(false);
    setSaveFailed(false);
    setRecapData([]);
    clearStorage();
  };

  // ==================== AUTO-SAVE TO SUPABASE ====================

  const autoSaveToSupabase = useCallback(async () => {
    if (!name || total === 0 || saved || !sessionId) return;
    setSaving(true);
    try {
      const finalEndTime = endTime ? new Date(endTime).toISOString() : new Date().toISOString();

      // Server already has all answers, just submit to finish
      const result = await submitSessionExamViaRpc(
        sessionId,
        finalEndTime
      );

      setScore(result.score);
      if (gameMode === 'survival') setTotalQuestions(result.total_attempted);
      setRecapData(result.recap);
      setSaved(true);
      setSaveFailed(false);
      clearStorage();
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [name, total, endTime, saved, sessionId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (step === 6 && !saved && !saveFailed && name && isRestored && total > 0) {
      void autoSaveToSupabase();
    }
  }, [autoSaveToSupabase, isRestored, name, saved, saveFailed, step, total]);

  // Global Timer Effect
  useEffect(() => {
    if (step !== 3 || !expiresAt) return;

    const interval = setInterval(() => {
      const expiry = new Date(expiresAt).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeftDisplay('TIME EXPIRED');
        void endSession(true); // Auto-submit without saving current answer to prevent race condition
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeftDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [step, expiresAt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ==================== HELPERS ====================

  const categoryLabel = availableCategories.find(c => c.value === category)?.label ?? category;

  // ==================== RENDER ====================

  if (!isRestored) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-nike-grey-500 font-medium">RESTORING SESSION...</div>
      </div>
    );
  }

  // Step 1: Name Entry + Category + Question Count
  if (step === 1) {
    return (
      <div className="flex-1 flex flex-col pt-16 md:pt-24 px-6">
        <div className="max-w-3xl mx-auto w-full">
          <h1 className="font-display text-[56px] sm:text-[96px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-8 md:mb-12">
            Take The<br />Exam.
          </h1>
          <div className="max-w-md w-full space-y-6">
            {/* Game Mode Selector */}
            <div className="space-y-3">
              <span className="block text-[16px] font-medium text-nike-black uppercase tracking-tight">Select Mode</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setGameMode('exam')}
                  className={`flex-1 h-[44px] rounded-[22px] text-[14px] font-bold transition-all uppercase tracking-wider ${gameMode === 'exam'
                    ? 'bg-nike-black text-nike-white'
                    : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-black hover:bg-nike-grey-100'
                    }`}
                >
                  📝 Exam
                </button>
                <button
                  onClick={() => setGameMode('survival')}
                  className={`flex-1 h-[44px] rounded-[22px] text-[14px] font-bold transition-all uppercase tracking-wider ${gameMode === 'survival'
                    ? 'bg-nike-red text-nike-white'
                    : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-red hover:bg-red-50'
                    }`}
                >
                  ⚔️ Survival
                </button>
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-3">
              <span className="block text-[16px] font-medium text-nike-black uppercase tracking-tight">Your Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ENTER NAME"
                className="w-full bg-nike-grey-100 rounded-[12px] border border-nike-grey-300 px-4 h-[48px] text-[16px] placeholder-nike-grey-400 focus:outline-none focus:border-nike-black transition-all uppercase font-medium"
              />
            </div>

            {/* Category Selector Dropdown */}
            <div className="space-y-3">
              <span className="block text-[16px] font-medium text-nike-black uppercase tracking-tight">Question Category</span>
              {fetchError ? (
                <div className="w-full flex items-center justify-between bg-nike-red/10 p-4 rounded-[12px] border border-nike-red/20">
                  <p className="text-nike-red text-[14px] font-medium uppercase">Connection Error</p>
                  <button
                    onClick={() => (window as any).__retryCategoryFetch?.()}
                    className="px-4 h-[32px] rounded-[16px] bg-nike-red text-nike-white text-[10px] font-bold uppercase hover:bg-nike-red/80 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : availableCategories.length === 0 ? (
                <div className="flex items-center gap-2 h-[48px]">
                  <div className="w-4 h-4 border-2 border-nike-grey-300 border-t-nike-black rounded-full animate-spin"></div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase tracking-wider">Syncing categories...</p>
                </div>
              ) : (
                <select
                  value={category || 'none'}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-nike-grey-100 rounded-[8px] border border-nike-grey-300 px-4 h-[48px] text-[16px] focus:outline-none focus:border-nike-black transition-colors uppercase font-medium appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em' }}
                >
                  <option value="none">PILIH KATEGORI (NONE)</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Time Limit Selector Buttons */}
            <div className="space-y-3">
              <span className="block text-[16px] font-medium text-nike-black uppercase tracking-tight">Time Limit (Global)</span>
              <div className="flex flex-wrap gap-2">
                {TIME_LIMIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeLimit(opt.value)}
                    className={`px-6 h-[44px] rounded-[22px] text-[14px] font-bold uppercase transition-all whitespace-nowrap ${timeLimit === opt.value
                      ? 'bg-nike-black text-nike-white'
                      : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-grey-500 hover:bg-nike-grey-100'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count Selector — hidden in Survival mode */}
            {!isSurvival && (
              <div className="space-y-3">
                <span className="block text-[16px] font-medium text-nike-black uppercase tracking-tight">Question Count</span>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`px-6 h-[44px] rounded-[22px] text-[16px] font-bold transition-all ${questionCount === count
                        ? 'bg-nike-black text-nike-white'
                        : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-grey-500 hover:bg-nike-grey-100'
                        }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!name.trim() || !category || category === 'none'}
              className="w-full h-[54px] rounded-[27px] bg-nike-black text-nike-white text-[16px] font-bold hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 disabled:cursor-not-allowed uppercase tracking-wider shadow-lg shadow-nike-black/10"
            >
              Begin Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Confirmation
  if (step === 2) {
    return (
      <div className="flex-1 flex flex-col pt-16 md:pt-32 px-6">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="font-display text-[48px] sm:text-[72px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-8">
            Confirm<br />Identity.
          </h2>
          <div className="max-w-md w-full">
            <div className="bg-nike-grey-100 p-6 rounded-[20px] mb-8 border border-nike-grey-200 space-y-4">
              <div>
                <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Candidate</p>
                <p className="text-[24px] font-bold text-nike-black uppercase">{name}</p>
              </div>
              <div className="flex gap-8 flex-wrap">
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Mode</p>
                  <p className={`text-[16px] font-bold uppercase ${isSurvival ? 'text-nike-red' : 'text-nike-black'}`}>{isSurvival ? '⚔️ Survival' : '📝 Exam'}</p>
                </div>
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Category</p>
                  <p className="text-[16px] font-bold text-nike-black uppercase">{categoryLabel}</p>
                </div>
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Questions</p>
                  <p className="text-[16px] font-bold text-nike-black">{isSurvival ? 'All' : questionCount}</p>
                </div>
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Time Limit</p>
                  <p className="text-[16px] font-bold text-nike-black uppercase">{TIME_LIMIT_OPTIONS.find(o => o.value === timeLimit)?.label}</p>
                </div>
                {isSurvival && (
                  <div>
                    <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Lives</p>
                    <p className="text-[16px] font-bold text-nike-red">❤️ ❤️ ❤️</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setStep(1)}
                className="w-full sm:w-auto px-8 h-[54px] rounded-[30px] bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black text-[16px] font-medium hover:border-nike-grey-500 hover:bg-nike-grey-100 transition-colors uppercase"
              >
                Edit
              </button>
              <button
                onClick={startExam}
                disabled={isLoading}
                className="w-full sm:w-auto px-8 h-[54px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors uppercase disabled:bg-nike-grey-200 disabled:text-nike-grey-500"
              >
                {isLoading ? 'Preparing...' : 'Start Exam'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === PREPARING_STEP) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-widest mb-3">Preparing</p>
          <p className="text-[12px] text-nike-grey-300 uppercase tracking-[0.2em]">Loading your first question</p>
        </div>
      </div>
    );
  }

  // Steps 3-5: Questions
  if (step >= 3 && step <= 5 && currentQuestion) {
    return (
      <div className="flex-1 flex flex-col px-6 pt-6 pb-12 md:pt-8 md:pb-16">
        <div className="max-w-6xl mx-auto w-full">
          {/* Survival: Score Counter */}
          {isSurvival && (
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <span className="text-[24px] font-bold text-nike-black">{score}</span>
                <span className="text-[12px] font-medium text-nike-grey-500 uppercase tracking-widest">Score</span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={`text-[24px] transition-all ${i < lives ? '' : 'grayscale opacity-30'}`}>
                    ❤️
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Progress & Status */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 pb-4 border-b border-nike-grey-200 gap-4">
            <div className="flex flex-col">
              <span className="text-[17px] font-bold text-nike-black uppercase tracking break-words">
                {name}
              </span>
              <span className="text-[12px] font-medium text-nike-grey-400 uppercase tracking-widest mb-1">
                Kategori: {categoryLabel} {isSurvival && '· Survival'} · Soal Nomor {current + 1}
              </span>
            </div>

            <div className="flex items-center gap-6">
              {expiresAt && (
                <div className="flex items-center gap-2 bg-nike-grey-100 px-4 py-2 rounded-full border border-nike-grey-200 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-nike-red animate-pulse"></div>
                  <span className="text-[14px] font-black font-mono text-nike-black">{timeLeftDisplay}</span>
                </div>
              )}

              <div className="sm:text-right">
                {hasAnswerSelected ? (
                  <span className="text-[14px] font-bold text-nike-green uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full">
                    Answer Saved
                  </span>
                ) : (
                  <span className="text-[14px] font-bold text-nike-grey-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">
                    Pending Response
                  </span>
                )}
              </div>
            </div>
          </div>

          <QuestionDisplay
            currentQuestion={currentQuestion}
            selectedAnswer={answers[current]}
            onSelectAnswer={selectAnswer}
          />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-nike-grey-200 pt-8">
            <button
              onClick={nextQuestion}
              disabled={!hasAnswerSelected || feedbackResult !== null}
              className="w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              Next Question
            </button>
            {isSurvival ? (
              <button
                onClick={() => setShowSurrenderConfirm(true)}
                className="w-full sm:w-auto px-8 h-[60px] rounded-[30px] bg-transparent text-nike-red text-[16px] font-medium hover:bg-red-50 border border-nike-red/30 transition-colors uppercase tracking-wider"
              >
                🏳️ Surrender
              </button>
            ) : (
              <button
                onClick={skipQuestion}
                className="w-full sm:w-auto px-8 h-[60px] rounded-[30px] bg-transparent text-nike-grey-500 text-[16px] font-medium hover:text-nike-black transition-colors uppercase tracking-wider"
              >
                Skip
              </button>
            )}
          </div>

          {/* Feedback Popup */}
          {feedbackResult && (
            <div className="fixed top-0 left-0 w-screen h-[100dvh] z-50 flex items-center justify-center pointer-events-none px-4 sm:px-6 backdrop-blur-[4px] bg-white/5 transition-all duration-300">
              <div className={`rounded-[32px] p-6 sm:p-10 max-w-[calc(100vw-32px)] sm:max-w-sm w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] backdrop-blur-2xl border-2 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center justify-center ${feedbackResult === 'correct' ? 'bg-nike-green/10 border-nike-green/40 text-nike-green' : 'bg-nike-red/10 border-nike-red/40 text-nike-red'}`}>
                <div className="mb-4 sm:mb-6 drop-shadow-md">
                  {feedbackResult === 'correct' ? (
                    <svg className="w-20 h-20 sm:w-24 sm:h-24 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-20 h-20 sm:w-24 sm:h-24 animate-pulse scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" className="opacity-40" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7l-2 5h4l-2 5" strokeWidth={2.5} />
                    </svg>
                  )}
                </div>
                <h3 className="font-display text-[28px] sm:text-[36px] leading-[0.9] uppercase text-center tracking-wide">
                  {feedbackResult === 'correct' ? 'Correct Answer' : 'WRONG ANSWER'}
                </h3>
              </div>
            </div>
          )}

          {/* Surrender Confirmation Dialog */}
          {showSurrenderConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
              <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🏳️</span>
                  </div>
                  <h3 className="font-display text-[32px] text-nike-black leading-none uppercase mb-2">Are you sure?</h3>
                  <p className="text-[14px] text-nike-grey-500 font-medium">
                    Surrendering will immediately end your current session and record your score.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowSurrenderConfirm(false);
                      surrender();
                    }}
                    className="w-full h-[54px] rounded-[30px] bg-nike-red text-white text-[16px] font-bold uppercase tracking-wider hover:bg-red-600 transition-colors"
                  >
                    Yes, Surrender
                  </button>
                  <button
                    onClick={() => setShowSurrenderConfirm(false)}
                    className="w-full h-[54px] rounded-[30px] bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black text-[16px] font-bold uppercase tracking-wider hover:bg-nike-grey-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 6: Score
  if (step === 6) {
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="flex-1 flex flex-col pt-16 md:pt-32 px-6">
        <div className="max-w-3xl mx-auto w-full text-center">
          {
            isSurvival ? (
              <div>
                <h2 className="font-display text-[96px] sm:text-[120px] text-nike-black leading-[0.85] tracking-[0.03em] uppercase mb-4">
                  {score}/{total}
                </h2>
                <p className="text-[24px] font-bold text-nike-grey-500 mb-2 uppercase pt-4">Question Answered</p>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-[96px] sm:text-[120px] text-nike-black leading-[0.85] tracking-[0.03em] uppercase mb-4">
                  {percentage}%
                </h2>
                <p className="text-[24px] font-bold text-nike-grey-500 mb-2 uppercase pt-4">{score}/{total} Correct Answers</p>
              </div>
            )
          }

          <p className="text-[14px] font-medium text-nike-grey-300 mb-12 uppercase tracking-widest">{categoryLabel}</p>

          <div className="h-[24px] mb-8">
            {saving ? (
              <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-widest">Syncing Results...</p>
            ) : saved ? (
              <p className="text-[14px] font-medium text-nike-green uppercase tracking-widest">Results Preserved</p>
            ) : saveFailed ? (
              <p className="text-[14px] font-medium text-nike-red uppercase tracking-widest">Sync Failed. Try Again.</p>
            ) : null}
          </div>

          <button
            onClick={() => goToStep(7)}
            className="w-full max-w-md mx-auto h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors uppercase tracking-wider block"
          >
            View Breakdown
          </button>
        </div>
      </div>
    );
  }

  // Step 7: Results
  if (step === 7) {
    const durationSeconds = startTime && endTime ? Math.floor((endTime - startTime) / 1000) : 0;
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    let formattedDuration = '';
    if (hours > 0) formattedDuration += `${hours} Hours, `;
    if (minutes > 0 || hours > 0) formattedDuration += `${minutes} Minutes, `;
    formattedDuration += `${seconds} Seconds`;

    return (
      <div className="flex-1 flex flex-col px-6 pt-6 pb-12 md:pt-8 md:pb-16">
        <div className="max-w-3xl mx-auto w-full">
          <div className="mb-12 border-b border-nike-black pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-[48px] sm:text-[64px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-2 flex flex-wrap items-baseline gap-4">
                <span>Performance.</span>
                {startTime && endTime && (
                  <span className="text-[16px] md:text-[20px] text-nike-grey-400 tracking-normal normal-case font-medium font-sans">{formattedDuration}</span>
                )}
              </h2>
              <p className="text-[20px] font-bold text-nike-black uppercase mb-1">{name}</p>
              <p className="text-[16px] font-medium text-nike-grey-500 uppercase">
                {isSurvival ? (
                  <>
                    You have answered <span className="font-bold text-nike-black">{recapData.filter((_, idx) => idx <= current).length}</span> questions
                  </>
                ) : (
                  `${categoryLabel} — ${score} / ${total}`
                )}
              </p>
            </div>
            <div>
              {saved ? (
                <span className="inline-block px-4 py-2 bg-nike-green text-nike-white text-[12px] font-bold uppercase rounded-[30px]">Recorded</span>
              ) : (
                <span className="inline-block px-4 py-2 bg-nike-grey-200 text-nike-grey-500 text-[12px] font-bold uppercase rounded-[30px]">Syncing</span>
              )}
            </div>
          </div>

          <div className="space-y-6 mb-12">
            {recapData
              .filter((_, idx) => !isSurvival || idx <= current)
              .map((item, idx) => {
                const userAnswer = item.user_answer;
                const correctText = item.correct_text;
                const isCorrect = item.is_correct;
                const isSkipped = !userAnswer;

                const userOptionHtml = userAnswer || null;

                return (
                  <div key={idx} className="bg-nike-grey-100 p-6 sm:p-8 rounded-[20px]">
                    <div className="flex gap-4 mb-4">
                      <span className="font-display text-[24px] text-nike-grey-300 shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                      <RichContent html={item.question_text} className="font-bold text-[18px] sm:text-[20px] text-nike-black pt-1 leading-tight flex-1 min-w-0" />
                    </div>

                    <div className="ml-[10px] sm:ml-[40px] pl-6 border-l-[2px] border-nike-grey-300">
                      {isSkipped ? (
                        <p className="text-[14px] font-medium text-nike-grey-500 uppercase">No Answer</p>
                      ) : isCorrect ? (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-nike-green mt-2 shrink-0"></div>
                          <div className="text-[16px] font-bold text-nike-green flex-1 min-w-0">
                            <p className="uppercase mb-1">CORRECT</p>
                            <RichContent html={userOptionHtml ?? ''} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-nike-red mt-2 shrink-0"></div>
                            <div className="text-[16px] font-bold text-nike-red flex-1 min-w-0">
                              <p className="uppercase mb-1">WRONG</p>
                              <RichContent html={userOptionHtml ?? ''} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="border-t border-nike-grey-200 pt-8">
            <button
              onClick={restart}
              className="w-full sm:w-auto px-12 h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors uppercase tracking-wider"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-nike-grey-500 font-medium mb-6 uppercase tracking-widest">Application Loading error...</p>
        <button onClick={restart} className="px-8 h-[50px] rounded-[30px] bg-nike-black text-nike-white font-medium hover:bg-nike-grey-500 uppercase transition-colors tracking-wider">
          Reset Session
        </button>
      </div>
    </div>
  );
}