"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { secureRemove } from '@/lib/security';
import { submitSecureAnswer, getJitQuestion, finishPlayerQuiz, type KuisLog, type Player } from '@/lib/quiz';
import { type ShuffledQuestion } from '@/lib/questions';

type UseQuizProgressOpsArgs = {
  player: Player | null;
  session: KuisLog | null;
  isFinished: boolean;
  quizCode: string;
  currentQuestion: ShuffledQuestion | null;
  currentIndex: number;
  startTime: number;
  selectedAnswerRef: MutableRefObject<string | null>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setCurrentQuestion: Dispatch<SetStateAction<ShuffledQuestion | null>>;
  setIsFinished: Dispatch<SetStateAction<boolean>>;
};

export default function useQuizProgressOps({
  player,
  session,
  isFinished,
  quizCode,
  currentQuestion,
  currentIndex,
  startTime,
  selectedAnswerRef,
  setLoading,
  setLoadError,
  setCurrentQuestion,
  setIsFinished,
}: UseQuizProgressOpsArgs) {
  const loadQuestion = useCallback(async (index: number) => {
    if (!player) return;
    setLoading(true);
    setLoadError(null);
    const qData = await getJitQuestion(player.id, index);
    if (qData) {
      setCurrentQuestion(qData);
    } else {
      setLoadError('Gagal mengambil soal. Silakan refresh halaman atau hubungi admin.');
    }
    setLoading(false);
  }, [player, setCurrentQuestion, setLoadError, setLoading]);

  const handleTimeout = useCallback(async () => {
    if (!player || !session || isFinished) return;

    setLoading(true);
    setLoadError(null);

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const q = currentQuestion;

    if (q) {
      const currentSelection = selectedAnswerRef.current;
      const answerText = currentSelection || '';
      await submitSecureAnswer(player.id, q.id, answerText, timeTaken, currentIndex);
    }

    await finishPlayerQuiz(player.id);
    secureRemove(`quiz_index_${quizCode}`);
    secureRemove(`quiz_answers_${quizCode}`);
    secureRemove(`quiz_doubts_${quizCode}`);
    setIsFinished(true);
    setLoading(false);
  }, [player, session, isFinished, startTime, currentQuestion, currentIndex, quizCode, selectedAnswerRef, setLoading, setLoadError, setIsFinished]);

  return {
    loadQuestion,
    handleTimeout,
  };
}
