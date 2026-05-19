"use client";

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { useExamSecurity } from '@/app/hooks/useExamSecurity';
import { submitSecureAnswer, finishPlayerQuiz, type Player } from '@/lib/quiz';
import { type KuisLog } from '@/lib/quiz';
import { type ShuffledQuestion } from '@/lib/questions';
import { secureRemove } from '@/lib/security';

type UseQuizSecurityGuardArgs = {
  session: KuisLog | null;
  player: Player | null;
  isFinished: boolean;
  startTime: number;
  currentQuestion: ShuffledQuestion | null;
  currentIndex: number;
  quizCode: string;
  selectedAnswerRef: MutableRefObject<string | null>;
  setIsFinished: Dispatch<SetStateAction<boolean>>;
};

export default function useQuizSecurityGuard({
  session,
  player,
  isFinished,
  startTime,
  currentQuestion,
  currentIndex,
  quizCode,
  selectedAnswerRef,
  setIsFinished,
}: UseQuizSecurityGuardArgs) {
  const examSecurityActive = session?.status === 'active' && !!player && !isFinished;

  const { warningCount, showWarningModal, dismissWarning } = useExamSecurity({
    isActive: examSecurityActive,
    enableTabDetection: true,
    enableWakeLock: true,
    onForceSubmit: useCallback(() => {
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
    }, [player, isFinished, startTime, currentQuestion, currentIndex, quizCode, selectedAnswerRef, setIsFinished]),
  });

  return {
    warningCount,
    showWarningModal,
    dismissWarning,
  };
}
