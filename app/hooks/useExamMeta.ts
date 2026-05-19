"use client";

import { useMemo } from 'react';

export default function useExamMeta({
  preparingStep,
  timeLimitOptions,
  quizCodeLength,
}: {
  preparingStep: number;
  timeLimitOptions: ReadonlyArray<{ label: string; value: number }>;
  quizCodeLength: number;
}) {
  return useMemo(() => ({
    PREPARING_STEP: preparingStep,
    TIME_LIMIT_OPTIONS: timeLimitOptions,
    QUIZ_CODE_LENGTH: quizCodeLength,
  }), [preparingStep, timeLimitOptions, quizCodeLength]);
}
