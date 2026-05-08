"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QuestionDisplay from '@/app/components/QuestionDisplay';
import RichContent from '@/app/components/RichContent';
import {
  type ShuffledQuestion,
  type QuestionCount,
  type BabInfo,
  type SubBabInfo,
  QUESTION_COUNTS,
  startExamSessionViaRpc,
  getSessionQuestionViaRpc,
  getSessionStateViaRpc,
  saveSessionAnswerViaRpc,
  submitSessionExamViaRpc,
} from '@/lib/questions';
import { QUIZ_CODE_LENGTH, normalizeQuizCode } from '@/lib/quiz';
import { secureSave, secureLoad, secureClear } from '@/lib/security';
import { useExamSecurity } from '@/app/hooks/useExamSecurity';
import { getSafeMapels, getSafeBabs, getSafeSubBabsForMultiple } from '@/app/actions/categories';
type Answer = string | null;
type GameMode = 'exam' | 'survival';
type ExamMode = 'strict' | 'standard';

const PREPARING_STEP = 25;

// ─── MultiSelectDropdown Component ───
interface MultiSelectDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MultiSelectDropdown = ({ label, options, selectedValues, onChange, disabled, placeholder }: MultiSelectDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder || `Select ${label}`;
    if (selectedValues.length === options.length && options.length > 0) return `All ${label}s Selected`;
    if (selectedValues.length > 2) return `${selectedValues.length} ${label}s Selected`;
    return selectedValues.map(v => options.find(o => o.value === v)?.label || v).join(', ');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-nike-grey-100 rounded-[10px] border border-nike-grey-300 px-4 h-[44px] text-[14px] transition-all ${disabled || options.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-nike-black'
          }`}
      >
        <span className={`truncate font-medium ${selectedValues.length > 0 ? 'text-nike-black' : 'text-nike-grey-400'}`}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-4 h-4 text-nike-grey-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[110] mt-2 w-full bg-white border border-nike-grey-200 rounded-[12px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[250px] overflow-y-auto p-2 space-y-1">
            {options.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedValues.length === options.length) {
                      onChange([]);
                    } else {
                      onChange(options.map(o => o.value));
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] hover:bg-nike-grey-100 transition-colors text-left"
                >
                  <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedValues.length === options.length ? 'bg-nike-black border-nike-black' : 'border-nike-grey-300'
                    }`}>
                    {selectedValues.length === options.length && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[13px] font-bold uppercase tracking-tight text-nike-black">Select All</span>
                </button>
                <div className="h-[1px] bg-nike-grey-100 my-1" />
                {options.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] hover:bg-nike-grey-100 transition-colors text-left"
                  >
                    <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedValues.includes(option.value) ? 'bg-nike-black border-nike-black' : 'border-nike-grey-300'
                      }`}>
                      {selectedValues.includes(option.value) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[13px] font-medium ${selectedValues.includes(option.value) ? 'text-nike-black' : 'text-nike-grey-500'}`}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className="p-4 text-center text-nike-grey-400 text-[12px] uppercase font-bold tracking-widest">
                No Options Available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Local Storage keys
const STORAGE_KEYS = {
  NAME: 'exam_name',
  STEP: 'exam_step',
  CURRENT: 'exam_current',
  ANSWERS: 'exam_answers',
  SESSION_ID: 'exam_session_id',
  TOTAL: 'exam_total_questions',
  MAPELS: 'exam_mapels',
  BABS: 'exam_babs',
  SUB_BABS: 'exam_sub_babs',
  START_TIME: 'exam_start_time',
  MODE: 'exam_mode',
  LIVES: 'exam_lives',
  EXPIRES_AT: 'exam_expires_at',
  TIME_LIMIT: 'exam_time_limit',
  SCORE: 'exam_score',
  EXAM_MODE: 'exam_exam_mode',
  DOUBT_FLAGS: 'exam_doubt_flags',
};

const TIME_LIMIT_OPTIONS = [
  { label: 'No Time', value: 0 },
  { label: '30 Minutes', value: 30 },
  { label: '60 Minutes', value: 60 },
  { label: '90 Minutes', value: 90 },
  { label: '120 Minutes', value: 120 },
  { label: '150 Minutes', value: 150 },
  { label: '180 Minutes', value: 180 },
];

const HelpTooltip = ({ text }: { text: string }) => (
  <span className="relative group inline-block ml-1.5 align-middle">
    <button type="button" className="w-[14px] h-[14px] rounded-full bg-nike-grey-200 text-nike-grey-500 text-[9px] font-bold flex items-center justify-center hover:bg-nike-black hover:text-white transition-colors cursor-help pb-[1px]">?</button>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-nike-black text-white text-[10px] font-medium leading-relaxed rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center shadow-lg pointer-events-none lowercase first-letter:uppercase tracking-wide">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-nike-black"></div>
    </div>
  </span>
);

export default function ExamPage() {
  const router = useRouter();
  // App state
  const [userName, setUserName] = useState('');
  const [mapels, setMapels] = useState<string[]>([]);
  const [babs, setBabs] = useState<string[]>([]);
  const [subBabs, setSubBabs] = useState<string[]>([]);
  const [availableMapels, setAvailableMapels] = useState<BabInfo[]>([]);
  const [availableBabs, setAvailableBabs] = useState<BabInfo[]>([]);
  const [availableSubBabs, setAvailableSubBabs] = useState<SubBabInfo[]>([]);
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
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [quizCode, setQuizCode] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const isSurvival = gameMode === 'survival';
  const [examMode, setExamMode] = useState<ExamMode>('strict');
  const [doubtFlags, setDoubtFlags] = useState<boolean[]>([]);
  const [showNavPopup, setShowNavPopup] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const isStandard = examMode === 'standard' && !isSurvival;

  // ─── Anti-Cheat Security (text selection, right-click, shortcuts) ──
  const examSecurityActive = step >= 3 && step <= 5;
  useExamSecurity({
    isActive: examSecurityActive,
    enableTabDetection: false,
    enableWakeLock: true,
    onForceSubmit: () => { }, // Not used — tab detection disabled
  });

  const total = totalQuestions;
  const currentAnswerValue = answers[current];
  const hasAnswerSelected = total > 0 && typeof currentAnswerValue === 'string' && currentAnswerValue.trim().length > 0;

  // ==================== SCORE CALCULATION ====================
  // Score is now calculated securely on the server via RPC.
  // Local score state is updated by the server response.

  // ==================== LOCAL STORAGE FUNCTIONS ====================
  // We use secureSave directly from @/lib/security to reduce boilerplate.


  const loadFromStorage = () => {
    return {
      name: secureLoad<string>(STORAGE_KEYS.NAME),
      step: secureLoad<number>(STORAGE_KEYS.STEP),
      current: secureLoad<number>(STORAGE_KEYS.CURRENT),
      answers: secureLoad<Answer[]>(STORAGE_KEYS.ANSWERS),
      sessionId: secureLoad<string>(STORAGE_KEYS.SESSION_ID),
      total: secureLoad<number>(STORAGE_KEYS.TOTAL) || 0,
      mapels: secureLoad<string[]>(STORAGE_KEYS.MAPELS) || [],
      babs: secureLoad<string[]>(STORAGE_KEYS.BABS) || [],
      subBabs: secureLoad<string[]>(STORAGE_KEYS.SUB_BABS) || [],
      startTime: secureLoad<number>(STORAGE_KEYS.START_TIME),
      mode: secureLoad<GameMode>(STORAGE_KEYS.MODE) || 'exam',
      lives: secureLoad<number>(STORAGE_KEYS.LIVES) || 3,
      expiresAt: secureLoad<string>(STORAGE_KEYS.EXPIRES_AT),
      timeLimit: secureLoad<number>(STORAGE_KEYS.TIME_LIMIT) || 0,
      score: secureLoad<number>(STORAGE_KEYS.SCORE) || 0,
      examMode: secureLoad<ExamMode>(STORAGE_KEYS.EXAM_MODE) || 'strict',
      doubtFlags: secureLoad<boolean[]>(STORAGE_KEYS.DOUBT_FLAGS) || [],
    };
  };

  // ==================== AUTOMATIC PERSISTENCE ====================
  useEffect(() => {
    if (!isRestored) return; // Prevent overwriting storage with default state before restoration
    // Only save if we are in a valid state (e.g. have started or at least have a name)
    if (userName) secureSave(STORAGE_KEYS.NAME, userName);
    secureSave(STORAGE_KEYS.STEP, step);
    secureSave(STORAGE_KEYS.CURRENT, current);
    secureSave(STORAGE_KEYS.ANSWERS, answers);
    secureSave(STORAGE_KEYS.SESSION_ID, sessionId);
    secureSave(STORAGE_KEYS.TOTAL, totalQuestions);
    secureSave(STORAGE_KEYS.MAPELS, mapels);
    secureSave(STORAGE_KEYS.BABS, babs);
    secureSave(STORAGE_KEYS.SUB_BABS, subBabs);
    secureSave(STORAGE_KEYS.START_TIME, startTime);
    secureSave(STORAGE_KEYS.MODE, gameMode);
    secureSave(STORAGE_KEYS.LIVES, lives);
    secureSave(STORAGE_KEYS.SCORE, score);
    secureSave(STORAGE_KEYS.EXPIRES_AT, expiresAt);
    secureSave(STORAGE_KEYS.TIME_LIMIT, timeLimit);
    secureSave(STORAGE_KEYS.EXAM_MODE, examMode);
    secureSave(STORAGE_KEYS.DOUBT_FLAGS, doubtFlags);
  }, [isRestored, userName, step, current, answers, sessionId, totalQuestions, mapels, babs, subBabs, startTime, gameMode, lives, score, expiresAt, timeLimit, examMode, doubtFlags]);

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
          if (stored.name) setUserName(stored.name);
          setIsRestored(true);
          setIsLoading(false);
          return;
        }

        // Restore everything from Server State or Local Backups
        setUserName(state.name || stored.name || '');
        setSessionId(stored.sessionId!);
        setTotalQuestions(state.question_count);
        setMapels(state.mapel ? state.mapel.split(', ') : (stored.mapels || []));
        setBabs(state.bab ? state.bab.split(', ') : (stored.babs || []));
        setSubBabs(state.sub_bab ? state.sub_bab.split(', ') : (stored.subBabs || []));
        setGameMode((state.mode || stored.mode || 'exam') as GameMode);
        setExamMode(stored.examMode || 'strict');
        setLives(state.lives ?? stored.lives ?? 3);
        setScore(stored.score ?? 0);
        setDoubtFlags(stored.doubtFlags || Array(state.question_count).fill(false));
        if (stored.startTime) setStartTime(stored.startTime);

        // Map user_answers to local state
        const newAnswers = Array(state.question_count).fill(null);
        if (state.user_answers) {
          Object.keys(state.user_answers).forEach(k => {
            if (state.user_answers) {
              newAnswers[parseInt(k)] = state.user_answers[k];
            }
          });
        }
        setAnswers(newAnswers);

        // Fix rollback: calculate the correct index by taking the max of local state and server answered state
        let maxServerIndex = 0;
        if (state.user_answers) {
          for (let i = 0; i < state.question_count; i++) {
            if (state.user_answers[String(i)] != null) {
              maxServerIndex = i + 1;
            } else {
              break;
            }
          }
        }

        let restoreIndex = Math.max(stored.current ?? 0, maxServerIndex);
        if (restoreIndex > state.question_count) {
          restoreIndex = state.question_count;
        }

        setCurrent(restoreIndex);
        setStep(restoreIndex >= state.question_count ? 6 : 3);

        // Fetch current question data
        getSessionQuestionViaRpc(stored.sessionId!, restoreIndex).then(q => {
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
      if (stored.name) {
        setUserName(stored.name);
        setIsRestored(true);
      } else {
        setIsRestored(true);
      }
    } else if (stored.name) {
      setUserName(stored.name);
      setIsRestored(true);
    } else {
      setIsRestored(true);
    }

    // Fetch dynamic categories helper
    const loadMapels = async () => {
      try {
        setFetchError(null);
        const data = await getSafeMapels();
        if (data.length === 0) {
          console.warn("No mapels found in Supabase.");
        }
        setAvailableMapels(data);
        setMapels(prev => prev.filter(v => data.some((u: BabInfo) => u.value === v)));
      } catch (err: any) {
        console.error("Failed to load mapels:", err);
        setFetchError(err.message || "Failed to connect to server");
      }
    };

    loadMapels();
    (window as any).__retryCategoryFetch = loadMapels;
  }, []);

  useEffect(() => {
    const loadBabs = async () => {
      try {
        // Fetch Babs for ANY of the selected Mapels
        // If mapels empty, we could fetch all or none. Let's fetch none if no mapel selected to enforce hierarchy.
        if (mapels.length === 0) {
          setAvailableBabs([]);
          setBabs([]);
          return;
        }

        // We need a helper to fetch babs for multiple mapels.
        // Let's assume fetchbabs can handle multiple if we pass a comma string or update it.
        // For now, I'll update lib/questions to handle array or loop here.

        // Since we want to be efficient, let's use the first one for now or update fetchbabs.
        // Actually, I updated fetchbabs to take a single mapel.
        // I should probably update it to take string[].

        const promises = mapels.map(m => getSafeBabs(m));
        const results = await Promise.all(promises);
        const merged = results.flat();
        const seen = new Set();
        const unique = merged.filter(b => {
          if (seen.has(b.value)) return false;
          seen.add(b.value);
          return true;
        });

        setAvailableBabs(unique);
        setBabs(prev => prev.filter(v => unique.some(u => u.value === v)));
      } catch (err) {
        console.error(err);
      }
    };
    loadBabs();
  }, [mapels]);

  useEffect(() => {
    const loadSubBabs = async () => {
      try {
        if (babs.length === 0) {
          setAvailableSubBabs([]);
          setSubBabs([]);
          return;
        }
        const data = await getSafeSubBabsForMultiple(babs);
        setAvailableSubBabs(data);
        setSubBabs(prev => prev.filter(v => data.some((u: SubBabInfo) => u.value === v)));
      } catch (err) {
        console.error(err);
      }
    };
    loadSubBabs();
  }, [babs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ==================== FETCH & PREPARE NEW SESSION ====================

  const startNewSession = async () => {
    setIsLoading(true);
    try {
      const count = isSurvival ? 9999 : questionCount;
      const { sessionId: newSessionId, total: newTotal, expiresAt: serverExpiresAt } = await startExamSessionViaRpc(userName, mapels, babs, subBabs, gameMode, count, timeLimit);

      if (newTotal === 0) {
        throw new Error('Tidak ada soal di kategori ini.');
      }

      setSessionId(newSessionId);
      setTotalQuestions(newTotal);
      setAnswers(Array(newTotal).fill(null));
      setDoubtFlags(Array(newTotal).fill(false));
      setCurrent(0);
      setExpiresAt(serverExpiresAt);

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
    if (isSurvival) {
      setLives(3);
      setScore(0);
    }
    goToStep(PREPARING_STEP);
    await startNewSession();
    const now = Date.now();
    setStartTime(now);
    goToStep(3);
  };

  // ==================== STATE HANDLERS ====================

  const selectAnswer = (val: string) => {
    const updated = [...answers];
    updated[current] = val.trim().length > 0 ? val : null;
    setAnswers(updated);
  };

  const goToStep = (newStep: number) => {
    setStep(newStep);
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

      // Survival pool exhausted — no more questions available
      if (!nextQ && gameMode === 'survival') {
        void endSession(true);
        return;
      }

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

  // Standard mode: navigate to any question
  const goToQuestion = async (targetIndex: number) => {
    if (!sessionId || targetIndex < 0 || targetIndex >= total) return;
    if (targetIndex === current) {
      setShowNavPopup(false);
      return;
    }
    setShowNavPopup(false);
    await proceedToNext(targetIndex);
  };

  const nextQuestion = async () => {
    if (feedbackResult) return;

    if (isSurvival && currentQuestion) {
      const selectedAnswer = answers[current];

      setIsLoading(true);
      const result = await saveSessionAnswerViaRpc(sessionId!, current, selectedAnswer || 'skipped');
      setIsLoading(false);

      if (result?.error === 'time_expired') {
        void autoSaveToSupabase();
        return;
      }

      const isCorrect = result?.is_correct === true;
      setFeedbackResult(isCorrect ? 'correct' : 'wrong');

      setTimeout(() => {
        setFeedbackResult(null);
        if (isCorrect) {
          setScore(prev => {
            const newScore = prev + 1;

            return newScore;
          });
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
    setUserName('');
    setMapels([]);
    setBabs([]);
    setSubBabs([]);
    setQuestionCount(20);
    setStep(1);
    setCurrent(0);
    setSessionId(null);
    setCurrentQuestion(null);
    setTotalQuestions(0);
    setAnswers([]);
    setDoubtFlags([]);
    setScore(0);
    setStartTime(null);
    setEndTime(null);
    setGameMode('exam');
    setExamMode('strict');
    setLives(3);
    setSaved(false);
    setSaveFailed(false);
    setRecapData([]);
    clearStorage();
  };

  // ==================== AUTO-SAVE TO SUPABASE ====================

  const autoSaveToSupabase = useCallback(async () => {
    if (!userName || total === 0 || saved || !sessionId) return;
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
      // Rule 7: Replace history to prevent back-button navigation to active exam
      router.replace('/');
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [userName, total, endTime, saved, sessionId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (step === 6 && !saved && !saveFailed && userName && isRestored && total > 0) {
      void autoSaveToSupabase();
    }
  }, [autoSaveToSupabase, isRestored, userName, saved, saveFailed, step, total]);

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
        void handleTimerExpiry();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeftDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [step, expiresAt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * Triggered when the exam timer reaches zero.
   * 1. Saves the currently selected answer (if any) to the server.
   * 2. Calls submitSessionExamViaRpc to finalise the session.
   *    The server RPC records null for every unanswered question.
   */
  const handleTimerExpiry = async () => {
    if (!sessionId) return;

    // Flush the answer the user has currently selected but not yet submitted
    const currentAnswer = answers[current];
    if (currentAnswer) {
      try {
        await saveSessionAnswerViaRpc(sessionId, current, currentAnswer);
      } catch {
        // Best-effort — proceed to submit even if this flush fails
      }
    }

    // Move to score screen then auto-submit
    const now = Date.now();
    setEndTime(now);
    setStep(6);
    // autoSaveToSupabase is triggered by the step===6 useEffect,
    // but we call it directly here to avoid depending on stale state.
    setSaving(true);
    try {
      const finalEndTime = new Date(now).toISOString();
      const result = await submitSessionExamViaRpc(sessionId, finalEndTime);
      setScore(result.score);
      if (gameMode === 'survival') setTotalQuestions(result.total_attempted);
      setRecapData(result.recap);
      setSaved(true);
      setSaveFailed(false);
      clearStorage();
    } catch (err) {
      console.error('Timer auto-submit error:', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const handleJoinQuiz = async () => {
    const normalizedCode = normalizeQuizCode(quizCode);

    if (normalizedCode.length < QUIZ_CODE_LENGTH) {
      setCodeError(`Masukkan ${QUIZ_CODE_LENGTH}-karakter kode`);
      return;
    }

    setIsCheckingCode(true);
    setCodeError('');

    try {
      const { fetchQuizByCode } = await import('@/lib/quiz');
      const quiz = await fetchQuizByCode(normalizedCode);

      if (!quiz) {
        setCodeError('Kode tidak valid');
      } else if (quiz.status === 'finished') {
        setCodeError('Kuis telah berakhir');
      } else if (quiz.status === 'active' || quiz.status === 'paused') {
        setCodeError('Kuis sedang berjalan');
      } else {
        // Valid waiting session
        window.location.href = `/quiz/${quiz.quiz_code}`;
      }
    } catch (err) {
      setCodeError('Gagal menyambungkan');
    } finally {
      setIsCheckingCode(false);
    }
  };


  // ==================== HELPERS ====================

  const mapelsLabel = mapels.length > 0 ? mapels.map(m => availableMapels.find(am => am.value === m)?.label || m).join(', ') : 'None';
  const babsLabel = babs.length > 0 ? babs.map(b => availableBabs.find(ab => ab.value === b)?.label || b).join(', ') : 'None';
  const subBabsLabel = subBabs.length > 0 ? subBabs.map(sb => availableSubBabs.find(as => as.value === sb)?.label || sb).join(', ') : 'None';

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
      <div className="flex-1 flex flex-col pt-8 md:pt-14 px-6 pb-8">
        <div className="max-w-3xl mx-auto w-full">
          <h1 className="font-display text-[40px] sm:text-[64px] text-nike-black leading-[0.90] tracking-[0.03em] uppercase mb-5 md:mb-7">
            Take The<br />Exam.
          </h1>
          <div className="max-w-md w-full space-y-4">
            {/* Game Mode Selector */}
            <div className="space-y-2">
              <span className="block text-[13px] font-medium text-nike-black uppercase tracking-tight flex items-center">
                Select Mode
                <HelpTooltip text="Pilih mode ujian: Exam (biasa) atau Survival (nyawa terbatas)." />
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setGameMode('exam')}
                  className={`flex-1 h-[36px] rounded-[18px] text-[12px] font-bold transition-all uppercase tracking-wider ${gameMode === 'exam'
                    ? 'bg-nike-black text-nike-white'
                    : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-black hover:bg-nike-grey-100'
                    }`}
                >
                  📝 Exam
                </button>
                <button
                  onClick={() => { setGameMode('survival'); setExamMode('strict'); }}
                  className={`flex-1 h-[36px] rounded-[18px] text-[12px] font-bold transition-all uppercase tracking-wider ${gameMode === 'survival'
                    ? 'bg-nike-red text-nike-white'
                    : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-red hover:bg-red-50'
                    }`}
                >
                  ⚔️ Survival
                </button>
              </div>
              <div className="mt-2">
                <button
                  onClick={() => setIsJoinModalOpen(true)}
                  className="w-full h-[36px] rounded-[18px] text-[12px] font-bold transition-all uppercase tracking-wider bg-transparent border-[1.5px] border-nike-black text-nike-black hover:bg-nike-black hover:text-white shadow-sm"
                >
                  🎮 Join with Code
                </button>
              </div>
            </div>

            {/* Exam Mode Selector (only for exam mode) */}
            {!isSurvival && (
              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-nike-black uppercase tracking-tight flex items-center">
                  Navigation Mode
                  <HelpTooltip text="Strict: Soal berurutan, tidak bisa kembali. Standard: Bebas navigasi dan bisa menandai ragu-ragu." />
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExamMode('strict')}
                    className={`flex-1 h-[36px] rounded-[18px] text-[12px] font-bold transition-all uppercase tracking-wider ${examMode === 'strict'
                      ? 'bg-nike-black text-nike-white'
                      : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-black hover:bg-nike-grey-100'
                      }`}
                  >
                    🔒 Strict
                  </button>
                  <button
                    onClick={() => setExamMode('standard')}
                    className={`flex-1 h-[36px] rounded-[18px] text-[12px] font-bold transition-all uppercase tracking-wider ${examMode === 'standard'
                      ? 'bg-[#4A90D9] text-nike-white'
                      : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-[#4A90D9] hover:bg-blue-50'
                      }`}
                  >
                    📋 Standard
                  </button>
                </div>
                <p className="text-[10px] font-medium text-nike-grey-400 uppercase tracking-wider">
                  {examMode === 'strict' ? 'Sequential only, no going back.' : 'Free navigation, mark as doubtful.'}
                </p>
              </div>
            )}

            {/* Name Input */}
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-nike-black uppercase tracking-tight flex items-center">
                Your Name
                <HelpTooltip text="Nama yang akan ditampilkan pada papan skor (leaderboard)." />
              </span>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="ENTER NAME"
                className="w-full bg-nike-grey-100 rounded-[10px] border border-nike-grey-300 px-4 h-[40px] text-[14px] placeholder-nike-grey-400 focus:outline-none focus:border-nike-black transition-all uppercase font-medium"
              />
            </div>

            {/* Hierarchy Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Mapel */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-black text-nike-black uppercase tracking-widest opacity-60 flex items-center">
                  Mapel
                  <HelpTooltip text="Mata pelajaran yang ingin diujikan." />
                </span>
                <MultiSelectDropdown
                  label="Mapel"
                  options={availableMapels}
                  selectedValues={mapels}
                  onChange={setMapels}
                  placeholder="CHOOSE MAPEL"
                />
              </div>

              {/* BAB */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-black text-nike-black uppercase tracking-widest opacity-60 flex items-center">
                  BAB
                  <HelpTooltip text="Bab materi yang ingin diujikan." />
                </span>
                <MultiSelectDropdown
                  label="BAB"
                  options={availableBabs}
                  selectedValues={babs}
                  onChange={setBabs}
                  disabled={mapels.length === 0}
                  placeholder={mapels.length === 0 ? "CHOOSE MAPEL" : "CHOOSE BAB"}
                />
              </div>

              {/* Sub-bab */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-black text-nike-black uppercase tracking-widest opacity-60 flex items-center">
                  Sub-bab
                  <HelpTooltip text="Sub-bab materi yang ingin diujikan." />
                </span>
                <MultiSelectDropdown
                  label="Sub-bab"
                  options={availableSubBabs}
                  selectedValues={subBabs}
                  onChange={setSubBabs}
                  disabled={babs.length === 0}
                  placeholder={babs.length === 0 ? "CHOOSE BAB" : "CHOOSE SUB-BAB"}
                />
              </div>
            </div>

            {/* Time Limit Selector Buttons */}
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-nike-black uppercase tracking-tight flex items-center">
                Time Limit (Global)
                <HelpTooltip text="Batas waktu maksimal untuk menyelesaikan seluruh soal." />
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TIME_LIMIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeLimit(opt.value)}
                    className={`px-4 h-[34px] rounded-[17px] text-[12px] font-bold uppercase transition-all whitespace-nowrap ${timeLimit === opt.value
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
              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-nike-black uppercase tracking-tight flex items-center">
                  Question Count
                  <HelpTooltip text="Jumlah soal yang ingin dikerjakan." />
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUESTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`px-5 h-[34px] rounded-[17px] text-[13px] font-bold transition-all ${questionCount === count
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
              disabled={
                !userName.trim() ||
                mapels.length === 0 ||
                babs.length === 0 ||
                subBabs.length === 0
              }
              className="w-full h-[46px] rounded-[23px] bg-nike-black text-nike-white text-[14px] font-bold hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 disabled:cursor-not-allowed uppercase tracking-wider shadow-lg shadow-nike-black/10"
            >
              Begin Session
            </button>
          </div>

          {/* Join Live Quiz Modal */}
          {isJoinModalOpen && (
            <div className="fixed inset-0 bg-nike-white/40 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
              <div className="bg-nike-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] max-w-sm w-full border border-nike-grey-200 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-10 text-center">
                  <h2 className="font-display text-[40px] text-nike-black leading-[0.9] tracking-[0.03em] uppercase mb-2">
                    Join.<br />Live. Quiz.
                  </h2>
                  <p className="text-[12px] font-bold text-nike-grey-400 uppercase tracking-widest mb-10">Masukkan {QUIZ_CODE_LENGTH}-digit kode akses</p>

                  <div className="relative group mb-6">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={QUIZ_CODE_LENGTH}
                      value={quizCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, QUIZ_CODE_LENGTH);
                        setQuizCode(val);
                        if (codeError) setCodeError('');
                      }}
                      placeholder="000000"
                      className={`w-full bg-nike-grey-100 rounded-[20px] px-6 h-[72px] text-center text-[32px] font-display tracking-[0.3em] focus:outline-none focus:ring-4 transition-all ${codeError ? 'ring-nike-red/10 border-nike-red text-nike-red' : 'focus:ring-nike-black/5 border-nike-grey-200'
                        }`}
                    />
                    {codeError && (
                      <p className="absolute -bottom-6 left-0 right-0 text-[10px] font-black text-nike-red uppercase tracking-widest animate-in slide-in-from-top-1">
                        ⚠️ {codeError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-8 pt-0 space-y-3">
                  <button
                    onClick={handleJoinQuiz}
                    disabled={isCheckingCode || normalizeQuizCode(quizCode).length < QUIZ_CODE_LENGTH}
                    className="w-full h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-bold uppercase tracking-widest hover:bg-nike-grey-500 transition-all disabled:opacity-30 active:scale-[0.98]"
                  >
                    {isCheckingCode ? 'Verifying...' : 'Join Now'}
                  </button>
                  <button
                    onClick={() => {
                      setIsJoinModalOpen(false);
                      setQuizCode('');
                      setCodeError('');
                    }}
                    className="w-full h-[60px] rounded-[30px] bg-transparent text-nike-grey-400 text-[14px] font-bold uppercase tracking-widest hover:text-nike-black transition-colors"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          )}
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
                <p className="text-[24px] font-bold text-nike-black uppercase">{userName}</p>
              </div>
              <div className="flex gap-8 flex-wrap">
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Mode</p>
                  <p className={`text-[16px] font-bold uppercase ${isSurvival ? 'text-nike-red' : 'text-nike-black'}`}>{isSurvival ? '⚔️ Survival' : '📝 Exam'}</p>
                </div>
                {!isSurvival && (
                  <div>
                    <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Navigasi</p>
                    <p className={`text-[16px] font-bold uppercase ${examMode === 'standard' ? 'text-[#4A90D9]' : 'text-nike-black'}`}>
                      {examMode === 'standard' ? '📋 Standard' : '🔒 Strict'}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Topik</p>
                  <div className="flex flex-col text-[16px] font-bold text-nike-black uppercase">
                    <span>{mapelsLabel}</span>
                    <span>{babsLabel}</span>
                    <span>{subBabsLabel}</span>
                  </div>
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
                {userName}
              </span>
              <div className="flex flex-col text-[12px] font-medium text-nike-grey-400 uppercase tracking-widest mb-1 mt-1">
                <span>{mapelsLabel}</span>
                <span>{babsLabel}</span>
                <span>{subBabsLabel}</span>
                <span className="mt-1 text-nike-black font-bold">Soal Nomor {current + 1} {isSurvival && '· Survival'}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {timeLimit > 0 && expiresAt && (
                <div className="flex items-center gap-2 bg-nike-grey-100 px-4 py-2 rounded-full border border-nike-grey-200 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-nike-red animate-pulse"></div>
                  <span className="text-[14px] font-black font-mono text-nike-black">{timeLeftDisplay}</span>
                </div>
              )}

              {/* Standard Mode: Navigation Grid Button */}
              {isStandard && (
                <button
                  onClick={() => setShowNavPopup(true)}
                  className="h-10 px-3 sm:px-4 rounded-[12px] bg-nike-grey-100 border border-nike-grey-200 flex items-center justify-center gap-2 hover:bg-nike-grey-200 transition-colors shadow-sm"
                  title="Daftar Soal"
                >
                  <svg className="w-5 h-5 text-nike-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="text-xs sm:text-sm font-bold text-nike-black uppercase tracking-wider hidden sm:block">Daftar Soal</span>
                </button>
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
            {isStandard ? (
              /* Standard Mode: Back / Doubt / Next */
              <>
                <button
                  onClick={() => goToQuestion(current - 1)}
                  disabled={current === 0 || isLoading}
                  className="w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black text-[16px] font-medium hover:bg-nike-grey-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  ◀ Back
                </button>
                <button
                  onClick={() => {
                    const updated = [...doubtFlags];
                    updated[current] = !updated[current];
                    setDoubtFlags(updated);
                  }}
                  className={`w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] text-[16px] font-medium transition-all uppercase tracking-wider border-[1.5px] ${doubtFlags[current]
                    ? 'bg-yellow-400 border-yellow-400 text-nike-black shadow-lg shadow-yellow-400/20'
                    : 'bg-transparent border-nike-grey-300 text-nike-grey-500 hover:border-yellow-400 hover:text-yellow-600'
                    }`}
                >
                  🤔 Ragu-ragu
                </button>
                <button
                  onClick={() => {
                    if (current >= total - 1) {
                      setShowSubmitConfirm(true);
                    } else {
                      goToQuestion(current + 1);
                    }
                  }}
                  disabled={isLoading}
                  className="w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  {current >= total - 1 ? 'Finish' : 'Next ▶'}
                </button>
              </>
            ) : (
              /* Strict Mode: original buttons */
              <>
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
              </>
            )}
          </div>

          {/* Submit Confirmation Modal */}
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-xl font-bold text-nike-black mb-2">Selesai Ujian?</h3>
                <p className="text-nike-grey-500 text-sm mb-6">
                  Pastikan Anda sudah mengecek kembali semua jawaban Anda sebelum menyelesaikan ujian.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 h-12 rounded-[16px] font-bold text-nike-black bg-nike-grey-100 hover:bg-nike-grey-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      setShowSubmitConfirm(false);
                      endSession();
                    }}
                    className="flex-1 h-12 rounded-[16px] font-bold text-white bg-nike-black hover:bg-nike-grey-500 transition-colors"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Standard Mode: Navigation Popup */}
          {isStandard && showNavPopup && (
            <div className="fixed inset-0 z-[100] bg-nike-white/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] max-w-md w-full border border-nike-grey-200 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display text-[28px] text-nike-black leading-none uppercase">Daftar Soal</h3>
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
                <div className="px-8 pt-2 pb-8 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                    {Array.from({ length: total }, (_, i) => {
                      const isAnswered = answers[i] !== null && answers[i] !== undefined && String(answers[i]).trim().length > 0;
                      const isDoubt = doubtFlags[i] || false;
                      const isCurrent = i === current;
                      return (
                        <button
                          key={i}
                          onClick={() => goToQuestion(i)}
                          className={`h-10 rounded-[10px] text-[13px] font-black transition-all border-2 ${isCurrent
                            ? 'ring-2 ring-[#4A90D9] ring-offset-2'
                            : ''
                            } ${isDoubt
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

          <div className="flex flex-col gap-1 mb-12 text-[14px] font-medium text-nike-grey-300 uppercase tracking-widest">
            <p>{mapelsLabel}</p>
            <p>{babsLabel}</p>
            <p>{subBabsLabel}</p>
          </div>

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
              <div className="flex justify-between items-start mb-2">
                <p className="text-[20px] font-bold text-nike-black uppercase">{userName}</p>
                <p className="text-[18px] font-black text-nike-black uppercase">
                  {isSurvival ? (
                    <>
                      <span className="text-nike-grey-400 text-[12px] font-bold mr-2 tracking-widest">ANSWERED</span>
                      <span className="text-nike-red">{recapData.filter((_, idx) => idx <= current).length}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-nike-grey-400 text-[12px] font-bold mr-2 tracking-widest">SCORE</span>
                      <span className="text-nike-black">{score} / {total}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-0.5 mb-4">
                <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-tight">{mapelsLabel}</p>
                <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-tight">{babsLabel}</p>
                <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-tight">{subBabsLabel}</p>
              </div>
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
              .map((item, idx) => {
                const userAnswer = item.user_answer;
                const correctText = item.correct_text;
                const isCorrect = item.is_correct;
                const isSkipped = !userAnswer;

                return (
                  <div key={idx} className="bg-nike-grey-100 p-6 sm:p-8 rounded-[20px]">
                    <div className="flex gap-4 mb-4">
                      <span className="font-display text-[24px] text-nike-grey-300 shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                      <RichContent html={item.question_text} className="font-bold text-[18px] sm:text-[20px] text-nike-black pt-1 leading-tight flex-1 min-w-0" />
                    </div>

                    <div className="ml-[10px] sm:ml-[40px] pl-6 border-l-[2px] border-nike-grey-300">
                      {isSkipped ? (
                        <div className="space-y-4">
                          <p className="text-[14px] font-medium text-nike-grey-500 uppercase">Skipped</p>
                        </div>
                      ) : isCorrect ? (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-nike-green mt-2 shrink-0"></div>
                          <div className="text-[16px] font-bold text-nike-green flex-1 min-w-0">
                            <p className="uppercase mb-1 text-[12px] tracking-widest">CORRECT</p>
                            <RichContent html={userAnswer} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-5">
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-nike-red mt-2 shrink-0"></div>
                            <div className="text-[16px] font-bold text-nike-red flex-1 min-w-0">
                              <p className="uppercase mb-1 text-[12px] tracking-widest">YOUR ANSWER</p>
                              <RichContent html={userAnswer} />
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
