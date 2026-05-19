"use client";

import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Answer } from '@/app/hooks/examTypes';

type UseExamAnswerSelectionArgs = {
  answers: Answer[];
  current: number;
  total: number;
  setAnswers: Dispatch<SetStateAction<Answer[]>>;
};

export default function useExamAnswerSelection({
  answers,
  current,
  total,
  setAnswers,
}: UseExamAnswerSelectionArgs) {
  const hasAnswerSelected = useMemo(() => {
    const currentAnswerValue = answers[current];
    return total > 0 && typeof currentAnswerValue === 'string' && currentAnswerValue.trim().length > 0;
  }, [answers, current, total]);

  const selectAnswer = (val: string) => {
    const updated = [...answers];
    updated[current] = val.trim().length > 0 ? val : null;
    setAnswers(updated);
  };

  return {
    hasAnswerSelected,
    selectAnswer,
  };
}
