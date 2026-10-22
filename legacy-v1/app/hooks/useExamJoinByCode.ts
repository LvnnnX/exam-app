"use client";

import { useState } from 'react';
import { QUIZ_CODE_LENGTH, normalizeQuizCode } from '@/lib/quiz';

type UseExamJoinByCodeArgs = {
  quizCodeLength: number;
};

export default function useExamJoinByCode({ quizCodeLength }: UseExamJoinByCodeArgs) {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [quizCode, setQuizCode] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  const normalizedQuizCodeLength = normalizeQuizCode(quizCode).length;
  const canJoinQuiz = normalizedQuizCodeLength >= quizCodeLength;

  const handleJoinQuiz = async () => {
    const normalizedCode = normalizeQuizCode(quizCode);

    if (normalizedCode.length < QUIZ_CODE_LENGTH) {
      setCodeError(`Masukkan ${QUIZ_CODE_LENGTH}-karakter kode`);
      return;
    }

    setIsCheckingCode(true);
    setCodeError('');

    try {
      const { fetchQuizByCode } = await import('@/lib/quiz');
      const quiz = await fetchQuizByCode(normalizedCode);

      if (!quiz) {
        setCodeError('Kode tidak valid');
      } else if (quiz.status === 'finished') {
        setCodeError('Kuis telah berakhir');
      } else if ((quiz.status === 'active' || quiz.status === 'paused') && quiz.allow_join_mid_game === false) {
        setCodeError('Kuis sedang berjalan dan tidak menerima peserta baru');
      } else {
        // Kept as a full page load on purpose: the quiz page starts from a clean
        // document instead of inheriting exam-page state. Lint-only annotation.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/quiz/${quiz.quiz_code}`;
      }
    } catch {
      setCodeError('Gagal menyambungkan');
    } finally {
      setIsCheckingCode(false);
    }
  };

  const handleQuizCodeChange = (value: string) => {
    const val = value.replace(/[^0-9]/g, '').slice(0, QUIZ_CODE_LENGTH);
    setQuizCode(val);
    if (codeError) setCodeError('');
  };

  const closeJoinModal = () => {
    setIsJoinModalOpen(false);
    setQuizCode('');
    setCodeError('');
  };

  return {
    state: {
      isJoinModalOpen,
      quizCode,
      isCheckingCode,
      codeError,
      canJoinQuiz,
      normalizedQuizCodeLength,
    },
    setters: {
      setIsJoinModalOpen,
    },
    actions: {
      handleJoinQuiz,
      handleQuizCodeChange,
      closeJoinModal,
    },
  };
}
