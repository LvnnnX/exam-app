"use client";

import type useExamStorageSync from '@/app/hooks/useExamStorageSync';
import type { Answer, ExamMode, GameMode } from '@/app/hooks/examTypes';

type UseExamControllerCoreArgsBuilderArgs = Parameters<typeof useExamStorageSync>[0] & {
  gameMode: GameMode;
  examMode: ExamMode;
  answers: Answer[];
  sessionId: string | null;
  expiresAt: string | null;
  doubtFlags: boolean[];
};

export default function useExamControllerCoreArgs({
  gameMode,
  examMode,
  step,
  isRestored,
  userName,
  current,
  answers,
  sessionId,
  totalQuestions,
  mapels,
  babs,
  subBabs,
  startTime,
  lives,
  score,
  expiresAt,
  timeLimit,
  doubtFlags,
  storageKeys,
}: UseExamControllerCoreArgsBuilderArgs) {
  return {
    modeFlagsArgs: {
      gameMode,
      examMode,
    },
    securityStep: step,
    storageSyncArgs: {
      storageKeys,
      isRestored,
      userName,
      step,
      current,
      answers,
      sessionId,
      totalQuestions,
      mapels,
      babs,
      subBabs,
      startTime,
      gameMode,
      lives,
      score,
      expiresAt,
      timeLimit,
      examMode,
      doubtFlags,
    } satisfies Parameters<typeof useExamStorageSync>[0],
  };
}
