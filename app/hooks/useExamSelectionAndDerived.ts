"use client";

import useExamAnswerSelection from '@/app/hooks/useExamAnswerSelection';
import useExamDerivedValues from '@/app/hooks/useExamDerivedValues';

type UseExamSelectionAndDerivedArgs = {
  answerSelectionArgs: Parameters<typeof useExamAnswerSelection>[0];
  derivedValuesArgs: Parameters<typeof useExamDerivedValues>[0];
};

export default function useExamSelectionAndDerived({
  answerSelectionArgs,
  derivedValuesArgs,
}: UseExamSelectionAndDerivedArgs) {
  const {
    hasAnswerSelected,
    selectAnswer,
  } = useExamAnswerSelection(answerSelectionArgs);

  const {
    mapelsLabel,
    babsLabel,
    subBabsLabel,
    formattedDuration,
    answeredCount,
  } = useExamDerivedValues(derivedValuesArgs);

  return {
    hasAnswerSelected,
    selectAnswer,
    mapelsLabel,
    babsLabel,
    subBabsLabel,
    formattedDuration,
    answeredCount,
  };
}
