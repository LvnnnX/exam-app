"use client";

import { useEffect, useRef } from 'react';

export default function useSelectedAnswerRef(selectedAnswer: string | null) {
  const selectedAnswerRef = useRef<string | null>(null);

  useEffect(() => {
    selectedAnswerRef.current = selectedAnswer;
  }, [selectedAnswer]);

  return selectedAnswerRef;
}
