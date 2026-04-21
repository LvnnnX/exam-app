"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import QuestionDisplay from '@/app/components/QuestionDisplay';
import RichContent from '@/app/components/RichContent';
import {
  type ShuffledQuestion,
  type RawQuestion,
  type QuestionCount,
  type CategoryInfo,
  QUESTION_COUNTS,
  fetchQuestions,
  fetchCategories,
  prepareSessionQuestions,
} from '@/lib/questions';

type Answer = string | null;

const PREPARING_STEP = 25;

// Local Storage keys
const STORAGE_KEYS = {
  NAME: 'exam_name',
  STEP: 'exam_step',
  CURRENT: 'exam_current',
  ANSWERS: 'exam_answers',
  QUESTIONS: 'exam_questions',
  CATEGORY: 'exam_category',
  QUESTION_COUNT: 'exam_question_count',
};

export default function ExamPage() {
  // App state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('general_informatics');
  const [availableCategories, setAvailableCategories] = useState<CategoryInfo[]>([]);
  const [questionCount, setQuestionCount] = useState<QuestionCount>(20);
  const [step, setStep] = useState(1); // 1=Name, 2=Confirm, 25=Preparing, 3=Quiz, 6=Score, 7=Results
  const [current, setCurrent] = useState(0);
  const [sessionQuestions, setSessionQuestions] = useState<ShuffledQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [score, setScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const total = sessionQuestions.length;
  const currentQuestion = sessionQuestions[current] ?? null;
  const hasAnswerSelected = total > 0 && answers[current] !== null;

  // ==================== SCORE CALCULATION ====================

  const calculateScore = useCallback(() => {
    let s = 0;
    answers.forEach((a, idx) => {
      if (a && sessionQuestions[idx] && a === sessionQuestions[idx].correct_label) s++;
    });
    return s;
  }, [answers, sessionQuestions]);

  // ==================== LOCAL STORAGE FUNCTIONS ====================

  const saveNameToStorage = (userName: string) => {
    localStorage.setItem(STORAGE_KEYS.NAME, userName);
  };

  const saveStepToStorage = (stepValue: number) => {
    localStorage.setItem(STORAGE_KEYS.STEP, stepValue.toString());
  };

  const saveCurrentQuestionToStorage = (questionIndex: number) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT, questionIndex.toString());
  };

  const saveAnswersToStorage = (answersArray: Answer[]) => {
    localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answersArray));
  };

  const saveQuestionsToStorage = (questions: ShuffledQuestion[]) => {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
  };

  const saveCategoryToStorage = (cat: string) => {
    localStorage.setItem(STORAGE_KEYS.CATEGORY, cat);
  };

  const saveQuestionCountToStorage = (count: number) => {
    localStorage.setItem(STORAGE_KEYS.QUESTION_COUNT, count.toString());
  };

  const loadFromStorage = () => {
    const storedName = localStorage.getItem(STORAGE_KEYS.NAME);
    const storedStep = localStorage.getItem(STORAGE_KEYS.STEP);
    const storedCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT);
    const storedAnswers = localStorage.getItem(STORAGE_KEYS.ANSWERS);
    const storedQuestions = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    const storedCategory = localStorage.getItem(STORAGE_KEYS.CATEGORY);
    const storedQuestionCount = localStorage.getItem(STORAGE_KEYS.QUESTION_COUNT);

    return {
      name: storedName,
      step: storedStep ? parseInt(storedStep) : null,
      current: storedCurrent ? parseInt(storedCurrent) : 0,
      answers: storedAnswers ? JSON.parse(storedAnswers) : null,
      questions: storedQuestions ? JSON.parse(storedQuestions) as ShuffledQuestion[] : null,
      category: storedCategory as string | null,
      questionCount: storedQuestionCount ? parseInt(storedQuestionCount) as QuestionCount : null,
    };
  };

  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEYS.NAME);
    localStorage.removeItem(STORAGE_KEYS.STEP);
    localStorage.removeItem(STORAGE_KEYS.CURRENT);
    localStorage.removeItem(STORAGE_KEYS.ANSWERS);
    localStorage.removeItem(STORAGE_KEYS.QUESTIONS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORY);
    localStorage.removeItem(STORAGE_KEYS.QUESTION_COUNT);
  };

  // ==================== RESTORE STATE ON MOUNT ====================

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = loadFromStorage();

    if (stored.name && stored.step !== null && stored.questions && stored.questions.length > 0) {
      const restoredStep = stored.step === PREPARING_STEP ? 3 : stored.step;
      setName(stored.name);
      setSessionQuestions(stored.questions);
      setCurrent(stored.current || 0);
      setStep(restoredStep);

      if (stored.category) setCategory(stored.category);
      if (stored.questionCount) setQuestionCount(stored.questionCount);

      if (stored.answers && Array.isArray(stored.answers)) {
        setAnswers(stored.answers);
      } else {
        setAnswers(Array(stored.questions.length).fill(null));
      }

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
          // If no categories returned, it might be an empty DB or a connection issue
          console.warn("No categories found in Supabase.");
        }
        setAvailableCategories(data);
        if (data.length > 0 && !stored.category) {
          setCategory(data[0].value);
        }
      } catch (err: any) {
        console.error("Failed to load categories:", err);
        setFetchError(err.message || "Failed to connect to server");
      }
    };

    loadCategories();
    // Expose for retry button usage if needed
    (window as any).__retryCategoryFetch = loadCategories;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ==================== FETCH & PREPARE NEW SESSION ====================

  const startNewSession = async () => {
    setIsLoading(true);
    try {
      // Step 1 & 4: Fetch questions filtered by category
      const pool: RawQuestion[] = await fetchQuestions(category);

      // Steps 2-3: Shuffle and slice to the selected question count
      const prepared = prepareSessionQuestions(pool, questionCount);

      setSessionQuestions(prepared);
      setAnswers(Array(prepared.length).fill(null));
      setCurrent(0);

      // Persist session data
      saveQuestionsToStorage(prepared);
      saveAnswersToStorage(Array(prepared.length).fill(null));
      saveCurrentQuestionToStorage(0);
      saveCategoryToStorage(category);
      saveQuestionCountToStorage(questionCount);
    } catch (err) {
      console.error('Failed to prepare session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startExam = async () => {
    saveNameToStorage(name);
    goToStep(PREPARING_STEP);

    await startNewSession();

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

  const nextQuestion = () => {
    if (current < total - 1) {
      const nextIdx = current + 1;
      setCurrent(nextIdx);
      saveCurrentQuestionToStorage(nextIdx);
    } else {
      const finalScore = calculateScore();
      setScore(finalScore);
      goToStep(6);
    }
  };

  const skipQuestion = () => {
    if (current < total - 1) {
      const nextIdx = current + 1;
      setCurrent(nextIdx);
      saveCurrentQuestionToStorage(nextIdx);
    } else {
      const finalScore = calculateScore();
      setScore(finalScore);
      goToStep(6);
    }
  };

  const restart = () => {
    setName('');
    setCategory('general_informatics');
    setQuestionCount(20);
    setStep(1);
    setCurrent(0);
    setSessionQuestions([]);
    setAnswers([]);
    setScore(0);
    setSaved(false);
    clearStorage();
  };

  // ==================== AUTO-SAVE TO SUPABASE ====================

  const autoSaveToSupabase = useCallback(async () => {
    if (!name || total === 0) return;
    setSaving(true);
    try {
      const answersArray = answers.map((answer, idx) => ({
        question_id: sessionQuestions[idx]?.id ?? idx + 1,
        user_answer: answer || 'skipped',
        is_correct: answer !== null && sessionQuestions[idx] && answer === sessionQuestions[idx].correct_label
      }));

      const { error } = await supabase
        .from('exam_results')
        .insert([{
          name,
          score,
          total_questions: total,
          category,
          question_count: questionCount,
          taken_at: new Date().toISOString(),
          user_answers: answersArray
        }]);

      if (error) throw error;
      setSaved(true);
      clearStorage();
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      setSaving(false);
    }
  }, [answers, category, name, questionCount, score, sessionQuestions, total]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (step === 6 && !saved && name && isRestored && total > 0) {
      void autoSaveToSupabase();
    }
  }, [autoSaveToSupabase, isRestored, name, saved, step, total]);
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
          <h1 className="font-display text-[64px] sm:text-[96px] text-nike-black leading-[0.90] tracking-tighter uppercase mb-12">
            Take The<br />Exam.
          </h1>
          <div className="max-w-md w-full space-y-6">
            {/* Name Input */}
            <label className="block">
              <span className="block text-[16px] font-medium text-nike-black mb-2">ENTER YOUR FULL NAME</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="YOUR NAME"
                className="w-full bg-nike-grey-100 rounded-[8px] border border-nike-grey-300 px-4 h-[48px] text-[16px] placeholder-nike-grey-500 focus:outline-none focus:border-nike-black focus:ring-1 focus:ring-nike-black transition-colors uppercase"
              />
            </label>

            {/* Category Selector */}
            <label className="block">
              <span className="block text-[16px] font-medium text-nike-black mb-2">QUESTION CATEGORY</span>
              <div className="flex flex-wrap gap-3">
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
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-nike-grey-300 border-t-nike-black rounded-full animate-spin"></div>
                    <p className="text-nike-grey-500 text-[14px] font-medium uppercase tracking-wider">Syncing categories...</p>
                  </div>
                ) : (
                  availableCategories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`px-5 h-[44px] rounded-[30px] text-[14px] font-medium transition-all uppercase tracking-wider ${
                        category === cat.value
                          ? 'bg-nike-black text-nike-white'
                          : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-grey-500 hover:bg-nike-grey-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))
                )}
              </div>
            </label>

            {/* Question Count Selector */}
            <label className="block">
              <span className="block text-[16px] font-medium text-nike-black mb-2">NUMBER OF QUESTIONS</span>
              <div className="flex gap-3">
                {QUESTION_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`w-[72px] h-[44px] rounded-[30px] text-[16px] font-bold transition-all ${
                      questionCount === count
                        ? 'bg-nike-black text-nike-white'
                        : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-grey-500 hover:bg-nike-grey-100'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </label>

            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full h-[54px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 disabled:cursor-not-allowed uppercase"
            >
              Continue
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
          <h2 className="font-display text-[48px] sm:text-[72px] text-nike-black leading-[0.90] tracking-tighter uppercase mb-8">
            Confirm<br />Identity.
          </h2>
          <div className="max-w-md w-full">
            <div className="bg-nike-grey-100 p-6 rounded-[20px] mb-8 border border-nike-grey-200 space-y-4">
              <div>
                <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Candidate</p>
                <p className="text-[24px] font-bold text-nike-black uppercase">{name}</p>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Category</p>
                  <p className="text-[16px] font-bold text-nike-black uppercase">{categoryLabel}</p>
                </div>
                <div>
                  <p className="text-nike-grey-500 text-[14px] font-medium uppercase mb-1">Questions</p>
                  <p className="text-[16px] font-bold text-nike-black">{questionCount}</p>
                </div>
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
                className="flex-1 h-[54px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors uppercase disabled:bg-nike-grey-200 disabled:text-nike-grey-500"
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
      <div className="flex-1 flex flex-col px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto w-full">
          {/* Progress & Status */}
          <div className="flex justify-between items-end mb-8 pb-4 border-b border-nike-grey-200">
            <div className="flex flex-col">
              <span className="text-[17px] font-bold text-nike-black uppercase tracking-[0.2em] mb-1">
                {name}
              </span>
              <span className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-widest">
                Question {current + 1} / {total}
              </span>
            </div>
            {hasAnswerSelected ? (
              <span className="text-[14px] font-medium text-nike-green uppercase tracking-widest">
                Answer Saved
              </span>
            ) : (
              <span className="text-[14px] font-medium text-nike-grey-300 uppercase tracking-widest">
                Pending Response
              </span>
            )}
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
              disabled={!hasAnswerSelected}
              className="w-full sm:w-auto sm:flex-1 h-[60px] rounded-[30px] bg-nike-black text-nike-white text-[16px] font-medium hover:bg-nike-grey-500 transition-colors disabled:bg-nike-grey-200 disabled:text-nike-grey-500 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              Next Question
            </button>
            <button
              onClick={skipQuestion}
              className="w-full sm:w-auto px-8 h-[60px] rounded-[30px] bg-transparent text-nike-grey-500 text-[16px] font-medium hover:text-nike-black transition-colors uppercase tracking-wider"
            >
              Skip
            </button>
          </div>
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
          <h2 className="font-display text-[96px] sm:text-[120px] text-nike-black leading-[0.85] tracking-tighter uppercase mb-4">
            {score}/{total}
          </h2>
          <p className="text-[24px] font-bold text-nike-grey-500 mb-2 uppercase">{percentage}% Completed</p>
          <p className="text-[14px] font-medium text-nike-grey-300 mb-12 uppercase tracking-widest">{categoryLabel}</p>

          <div className="h-[24px] mb-8">
            {saving ? (
              <p className="text-[14px] font-medium text-nike-grey-500 uppercase tracking-widest">Syncing Results...</p>
            ) : saved ? (
              <p className="text-[14px] font-medium text-nike-green uppercase tracking-widest">Results Preserved</p>
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
    return (
      <div className="flex-1 flex flex-col px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto w-full">
          <div className="mb-12 border-b border-nike-black pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-[48px] sm:text-[64px] text-nike-black leading-[0.90] tracking-tighter uppercase mb-2">
                Performance.
              </h2>
              <p className="text-[20px] font-bold text-nike-black uppercase mb-1">{name}</p>
              <p className="text-[16px] font-medium text-nike-grey-500 uppercase">
                {categoryLabel} — {score} / {total}
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
            {sessionQuestions.map((q, idx) => {
              const userAnswer = answers[idx];
              const isCorrect = userAnswer === q.correct_label;
              const isSkipped = !userAnswer;

              const userOptionHtml = userAnswer
                ? q.options.find(o => o.label === userAnswer)?.text ?? userAnswer
                : null;

              return (
                <div key={idx} className="bg-nike-grey-100 p-6 sm:p-8 rounded-[20px]">
                  <div className="flex gap-4 mb-4">
                    <span className="font-display text-[24px] text-nike-grey-300">{(idx + 1).toString().padStart(2, '0')}</span>
                    <RichContent html={q.question_text} className="font-bold text-[18px] sm:text-[20px] text-nike-black pt-1 leading-tight" />
                  </div>

                  <div className="ml-[10px] sm:ml-[40px] pl-6 border-l-[2px] border-nike-grey-300">
                    {isSkipped ? (
                      <p className="text-[14px] font-medium text-nike-grey-500 uppercase">Input: Skipped</p>
                    ) : isCorrect ? (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-nike-green"></div>
                        <div className="text-[16px] font-bold text-nike-green">
                          <p className="uppercase mb-1">Correct</p>
                          <RichContent html={userOptionHtml ?? ''} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-nike-red"></div>
                          <div className="text-[16px] font-bold text-nike-red line-through opacity-70">
                            <p className="uppercase mb-1">Selected</p>
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