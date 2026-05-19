"use client";

import { useMemo } from 'react';
import type { ExamMode, GameMode } from '@/app/hooks/examTypes';

export default function useExamModeFlags({
  gameMode,
  examMode,
}: {
  gameMode: GameMode;
  examMode: ExamMode;
}) {
  return useMemo(() => {
    const isSurvival = gameMode === 'survival';
    const isStandard = examMode === 'standard' && !isSurvival;

    return {
      isSurvival,
      isStandard,
    };
  }, [gameMode, examMode]);
}
