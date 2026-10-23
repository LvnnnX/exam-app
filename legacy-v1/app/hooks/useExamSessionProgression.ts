"use client";

import { useCallback } from 'react';
import { getSessionQuestionViaRpc, saveSessionAnswerViaRpc, type ShuffledQuestion } from '@/lib/questions';
import type { Answer, GameMode, Feedback } from '@/app/hooks/examTypes';

type UseExamSessionProgressionArgs = {
  sessionId: string | null;
  current: number;
  total: number;
  answers: Answer[];
  currentQuestion: ShuffledQuestion | null;
  gameMode: GameMode;
  isSurvival: boolean;
  feedbackResult: Feedback;
  lives: number;
  setIsLoading: (value: boolean) => void;
  setCurrentQuestion: (value: ShuffledQuestion | null) => void;
  setCurrent: (value: number) => void;
  setShowNavPopup: (value: boolean) => void;
  setFeedbackResult: (value: Feedback) => void;
  setScore: (value: (prev: number) => number) => void;
  setLives: (value: number) => void;
  onEndSession: (skipSave?: boolean) => Promise<void>;
  onAutoSaveToSupabase: () => Promise<void>;
};

export default function useExamSessionProgression({
  sessionId,
  current,
  total,
  answers,
  currentQuestion,
  gameMode,
  isSurvival,
  feedbackResult,
  lives,
  setIsLoading,
  setCurrentQuestion,
  setCurrent,
  setShowNavPopup,
  setFeedbackResult,
  setScore,
  setLives,
  onEndSession,
  onAutoSaveToSupabase,
}: UseExamSessionProgressionArgs) {
  const scrollToQuestionTop = useCallback(() => {
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
  }, []);

  const proceedToNext = useCallback(async (nextIdx: number, skipSave = false) => {
    setIsLoading(true);
    try {
      if (!skipSave && answers[current]) {
        await saveSessionAnswerViaRpc(sessionId!, current, answers[current]);
      }
      const nextQ = await getSessionQuestionViaRpc(sessionId!, nextIdx);

      if (!nextQ && gameMode === 'survival') {
        await onEndSession(true);
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
  }, [setIsLoading, sessionId, current, answers, gameMode, onEndSession, setCurrentQuestion, setCurrent, scrollToQuestionTop]);

  const goToQuestion = useCallback(async (targetIndex: number) => {
    if (!sessionId || targetIndex < 0 || targetIndex >= total) return;
    if (targetIndex === current) {
      setShowNavPopup(false);
      return;
    }
    setShowNavPopup(false);
    await proceedToNext(targetIndex);
  }, [sessionId, total, current, setShowNavPopup, proceedToNext]);

  const nextQuestion = useCallback(async () => {
    if (feedbackResult) return;

    if (isSurvival && currentQuestion) {
      const selectedAnswer = answers[current];

      setIsLoading(true);
      const result = await saveSessionAnswerViaRpc(sessionId!, current, selectedAnswer || 'skipped');
      setIsLoading(false);

      if (result?.error === 'time_expired') {
        await onAutoSaveToSupabase();
        return;
      }

      const isCorrect = result?.is_correct === true;
      setFeedbackResult(isCorrect ? 'correct' : 'wrong');

      setTimeout(() => {
        setFeedbackResult(null);
        if (isCorrect) {
          setScore(prev => prev + 1);
        } else {
          const newLives = lives - 1;
          setLives(newLives);
          if (newLives <= 0) {
            void onEndSession(true);
            return;
          }
        }

        if (current < total - 1) {
          void proceedToNext(current + 1, true);
        } else {
          void onEndSession(true);
        }
      }, 1500);
      return;
    }

    if (current < total - 1) {
      await proceedToNext(current + 1);
    } else {
      await onEndSession();
    }
  }, [feedbackResult, isSurvival, currentQuestion, answers, current, setIsLoading, sessionId, onAutoSaveToSupabase, setFeedbackResult, setScore, lives, setLives, total, proceedToNext, onEndSession]);

  const skipQuestion = useCallback(async () => {
    if (sessionId) {
      await saveSessionAnswerViaRpc(sessionId, current, 'skipped');
    }

    if (current < total - 1) {
      await proceedToNext(current + 1, true);
    } else {
      await onEndSession(true);
    }
  }, [sessionId, current, total, proceedToNext, onEndSession]);

  return {
    proceedToNext,
    goToQuestion,
    nextQuestion,
    skipQuestion,
  };
}
